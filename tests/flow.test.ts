import assert from "node:assert/strict";
import http from "node:http";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { before, test } from "node:test";
import { signBody } from "../lib/crypto";
import { resetDb } from "../lib/db/client";
import { organizations } from "../lib/db/schema";
import { eq } from "drizzle-orm";
import { getDb } from "../lib/db/client";
import { registerAccount } from "../lib/services/accounts";
import { createApiKey } from "../lib/services/keys";
import { getInvoice } from "../lib/services/invoices";
import { createProject, setNumeracao } from "../lib/services/projects";
import { runTick } from "../lib/simulation/sweeper";
import { POST as emitir } from "../app/api/v1/emitir/route";
import { POST as createWebhook } from "../app/api/v1/webhooks/endpoints/route";
import { POST as cancelar } from "../app/api/v1/cancelar/route";
import { GET as status } from "../app/api/v1/invoices/[id]/status/route";
import { GET as pdf } from "../app/api/v1/invoices/[id]/pdf/route";
import { GET as xml } from "../app/api/v1/invoices/[id]/xml/route";

process.env.DATABASE_PATH = path.join(mkdtempSync(path.join(tmpdir(), "bancada-")), "estudo.sqlite");

const CNPJ = "11222333000181";
let token = "";
let projectId = "";
let orgId = "";

before(() => {
  resetDb();
  const account = registerAccount({
    name: "Ana Estudo",
    email: "ana@estudo.test",
    password: "senha-segura",
    organizationName: "Laboratório",
  });
  orgId = account.orgId;
  const project = createProject(orgId, { name: "Filial", cnpj: CNPJ, razaoSocial: "Filial de Estudo LTDA" });
  projectId = project.id;
  token = createApiKey({ organizationId: orgId, projectId, kind: "project", name: "aula", rateLimitPerMinute: 30 }).key;
});

function nota(extra: Record<string, unknown> = {}) {
  return {
    tomador: { nome: "Cliente Exemplo LTDA", cnpj: "19131243000197", email: "financeiro@cliente.test" },
    servico: { descricao: "Aula de integração fiscal", codigo: "010700" },
    valores: { total: 1500, aliquotaIss: 2 },
    competencia: "2026-03",
    referencia: "OS-1",
    ...extra,
  };
}

async function postEmit(body: unknown, headers: Record<string, string> = {}) {
  return emitir(
    new Request("http://bancada.local/api/v1/emitir", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": token, ...headers },
      body: JSON.stringify(body),
    }),
  );
}

test("emite com atraso visível e só conclui depois do prazo", async () => {
  const response = await postEmit({ ...nota(), simulacao: { resultado: "sucesso", atrasoMs: 2000 } });
  assert.equal(response.status, 202);
  const created = await response.json();
  const queued = await status(new Request(`http://bancada.local/api/v1/invoices/${created.invoiceId}/status`, { headers: { "x-api-key": token } }), {
    params: Promise.resolve({ id: created.invoiceId }),
  });
  assert.equal((await queued.json()).status, "queued");
  const pending = getInvoice(created.invoiceId)!;
  await runTick(pending.processAfter! - 1);
  assert.equal(getInvoice(created.invoiceId)?.status, "queued");
  await runTick(pending.processAfter!);
  assert.equal(getInvoice(created.invoiceId)?.status, "processing");
  await runTick(pending.readyAt);
  const issued = getInvoice(created.invoiceId);
  assert.equal(issued?.status, "issued");
  assert.match(issued?.chNfse ?? "", /^ESTUDO-/);
  const file = await pdf(new Request("http://bancada.local/pdf", { headers: { "x-api-key": token } }), {
    params: Promise.resolve({ id: created.invoiceId }),
  });
  assert.equal(file.status, 200);
  const bytes = Buffer.from(await file.arrayBuffer());
  assert.equal(bytes.subarray(0, 4).toString(), "%PDF");
  assert.match(bytes.toString("latin1"), /00460049005300430041004C/);
});

test("rejeição forçada não consome cota e devolve o erro", async () => {
  const beforeCredits = getDb().db.select().from(organizations).where(eq(organizations.id, orgId)).get()!.creditsUsed;
  const response = await postEmit(nota(), { "x-simulacao": "rejeicao:0" });
  const created = await response.json();
  await runTick(Date.now() + 10);
  const invoice = getInvoice(created.invoiceId);
  assert.equal(invoice?.status, "error");
  assert.equal(invoice?.errorCode, "E001");
  const after = getDb().db.select().from(organizations).where(eq(organizations.id, orgId)).get()!.creditsUsed;
  assert.equal(after, beforeCredits);
  const document = await xml(new Request("http://bancada.local/xml", { headers: { "x-api-key": token } }), {
    params: Promise.resolve({ id: created.invoiceId }),
  });
  assert.equal(document.status, 409);
});

test("idempotência não duplica a nota e muda de corpo dá conflito", async () => {
  const headers = { "idempotency-key": "aula-1" };
  const first = await postEmit({ ...nota(), simulacao: { resultado: "sucesso", atrasoMs: 0 } }, headers);
  const second = await postEmit({ ...nota(), simulacao: { resultado: "sucesso", atrasoMs: 0 } }, headers);
  assert.equal(first.status, 202);
  assert.equal(second.status, 202);
  assert.equal(second.headers.get("Idempotent-Replayed"), "true");
  const again = await postEmit({ ...nota(), referencia: "outra" }, headers);
  assert.equal(again.status, 409);
});

test("cancelamento aceito e recusado", async () => {
  const created = await (await postEmit({ ...nota(), simulacao: { resultado: "sucesso", atrasoMs: 0 } })).json();
  await runTick(Date.now() + 5);
  const ok = await cancelar(
    new Request("http://bancada.local/api/v1/cancelar", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": token },
      body: JSON.stringify({ invoiceId: created.invoiceId, motivo: "Erro de digitação na aula", simulacao: { resultado: "sucesso", atrasoMs: 0 } }),
    }),
  );
  assert.equal(ok.status, 202);
  await runTick(Date.now() + 5);
  assert.equal(getInvoice(created.invoiceId)?.status, "cancelled");
  const cancelXml = await xml(new Request("http://bancada.local/xml?type=cancel", { headers: { "x-api-key": token } }), {
    params: Promise.resolve({ id: created.invoiceId }),
  });
  assert.match(await cancelXml.text(), /NfseEstudoCancelamento/);

  const other = await (await postEmit({ ...nota(), simulacao: { resultado: "sucesso", atrasoMs: 0 } })).json();
  await runTick(Date.now() + 5);
  await cancelar(
    new Request("http://bancada.local/api/v1/cancelar", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": token },
      body: JSON.stringify({ invoiceId: other.invoiceId, simulacao: { resultado: "timeout", atrasoMs: 0 } }),
    }),
  );
  await runTick(Date.now() + 5);
  const back = getInvoice(other.invoiceId);
  assert.equal(back?.status, "issued");
  assert.match(back?.cancelError ?? "", /Timeout simulado/);
});

test("numeração nunca diminui", () => {
  const jumped = setNumeracao(projectId, orgId, 40);
  assert.equal(jumped.nfse.proximoNumero, 41);
  const ignored = setNumeracao(projectId, orgId, 3);
  assert.deepEqual(ignored.ignorado, ["ultimoNumeroNfse"]);
  assert.equal(ignored.nfse.ultimoNumero, 40);
});

test("webhook assinado na emissão", async () => {
  const hits: { event: string; signature: string; body: string }[] = [];
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      hits.push({
        event: String(req.headers["x-notaas-event"] ?? ""),
        signature: String(req.headers["x-notaas-signature"] ?? ""),
        body: Buffer.concat(chunks).toString(),
      });
      res.writeHead(204);
      res.end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  const hook = await createWebhook(
    new Request("http://bancada.local/api/v1/webhooks/endpoints", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": token },
      body: JSON.stringify({
        url: `http://127.0.0.1:${port}/hook`,
        events: ["nfse.issued", "nfse.documents_ready"],
        secret: "segredo-aula",
      }),
    }),
  );
  assert.equal(hook.status, 201);
  const created = await (await postEmit({ ...nota(), simulacao: { resultado: "sucesso", atrasoMs: 0 } })).json();
  await runTick(Date.now() + 20);
  assert.equal(getInvoice(created.invoiceId)?.status, "issued");
  const issued = hits.find((hit) => hit.event === "nfse.issued");
  assert.ok(issued);
  assert.equal(issued.signature, signBody("segredo-aula", issued.body));
  assert.match(issued.body, /sem valor fiscal/i);
  server.close();
});

test("chave inválida e cota esgotada", async () => {
  const denied = await emitir(
    new Request("http://bancada.local/api/v1/emitir", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": "ntaas_nao-existe" },
      body: JSON.stringify(nota()),
    }),
  );
  assert.equal(denied.status, 401);
  getDb().db.update(organizations).set({ creditsUsed: 50, creditsLimit: 50 }).where(eq(organizations.id, orgId)).run();
  const blocked = await postEmit({ ...nota(), simulacao: { resultado: "sucesso", atrasoMs: 0 } });
  assert.equal(blocked.status, 403);
});
