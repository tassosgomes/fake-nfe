import assert from "node:assert/strict";
import test from "node:test";
import { isCnpj, isCpf } from "../lib/cnpj";
import { signBody } from "../lib/crypto";
import { buildXml } from "../lib/nfse/documents";
import { pickDelay, pickResult, schedule } from "../lib/simulation/decide";
import type { invoices, projects } from "../lib/db/schema";

test("valida CPF e CNPJ", () => {
  assert.equal(isCnpj("11.222.333/0001-81"), true);
  assert.equal(isCnpj("11.222.333/0001-80"), false);
  assert.equal(isCpf("529.982.247-25"), true);
  assert.equal(isCpf("529.982.247-24"), false);
});

test("sorteia sucesso quando a taxa é zero e falha quando é cem", () => {
  assert.equal(pickResult({ failureRate: 0, random: () => 0 }).result, "sucesso");
  assert.equal(pickResult({ failureRate: 100, random: () => 0 }).result, "rejeicao");
  assert.equal(pickResult({ failureRate: 100, forced: "timeout" }).result, "timeout");
  assert.equal(pickResult({ failureRate: 100, forced: "sucesso" }).source, "forcado");
});

test("atraso fica dentro dos limites e o zero conclui no mesmo instante", () => {
  assert.equal(pickDelay(1000, 5000, 250), 250);
  assert.equal(pickDelay(1000, 5000, undefined, () => 0), 1000);
  assert.equal(pickDelay(1000, 5000, undefined, () => 1), 5000);
  const zero = schedule(1_000, 0);
  assert.equal(zero.processAfter, 1_000);
  assert.equal(zero.readyAt, 1_000);
  const slow = schedule(1_000, 3_000);
  assert.ok(slow.processAfter > 1_000 && slow.processAfter < slow.readyAt);
});

test("xml de estudo não imita leiaute oficial", () => {
  const invoice = {
    payloadJson: JSON.stringify({ tomador: { nome: "Cliente <Teste>" }, servico: { descricao: "Aula" }, valores: { total: 10 } }),
    numeroNfse: "000001",
    serie: "1608",
    chNfse: "ESTUDO-1608-000001",
    status: "issued",
    competencia: "2026-03",
    cancelledAt: null,
    cancelMotivo: null,
  } as typeof invoices.$inferSelect;
  const project = {
    cnpj: "11222333000181",
    razaoSocial: "Estudo LTDA",
    inscricaoMunicipal: null,
  } as typeof projects.$inferSelect;
  const xml = buildXml(invoice, project, "emission");
  assert.match(xml, /NfseEstudo/);
  assert.match(xml, /sem valor fiscal/i);
  assert.match(xml, /Cliente &lt;Teste&gt;/);
  assert.doesNotMatch(xml, /xmlns/);
  assert.equal(invoice.chNfse?.startsWith("ESTUDO-"), true);
});

test("assinatura HMAC", () => {
  const body = '{"evento":"nfse.issued"}';
  const signature = signBody("segredo", body);
  assert.equal(signature, signBody("segredo", body));
  assert.notEqual(signature, signBody("outro", body));
  assert.match(signature, /^sha256=[0-9a-f]+$/);
});
