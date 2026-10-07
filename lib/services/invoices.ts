import { and, desc, eq, inArray, like, lte, or, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import { emailOutbox, invoices, organizations, projects, type invoices as invoiceTable } from "../db/schema";
import { StudyError } from "../errors";
import { parseJson } from "../format";
import { newId } from "../ids";
import {
  CANCEL_FAILURES,
  FAILURES,
  QUOTA_ERROR,
  STUDY_AVISO,
  type SimResult,
} from "../plan";
import { competenciaAtual } from "../format";
import { pickDelay, pickResult, schedule, type SimOverride } from "../simulation/decide";
import type { EmitInput } from "../validation";
import { enqueueEvent } from "./webhooks";

type Invoice = typeof invoiceTable.$inferSelect;
type Project = typeof projects.$inferSelect;
type Org = typeof organizations.$inferSelect;

export type TimelineEvent = { em: number; titulo: string; detalhe: string };

function timeline(invoice: Invoice): TimelineEvent[] {
  return parseJson<TimelineEvent[]>(invoice.timelineJson, []);
}

function pushTimeline(current: string, event: TimelineEvent): string {
  const events = parseJson<TimelineEvent[]>(current, []);
  events.push(event);
  return JSON.stringify(events);
}

export function publicInvoice(invoice: Invoice, origin: string) {
  const documents = invoice.status === "issued" || invoice.status === "cancelled";
  return {
    invoiceId: invoice.id,
    status: invoice.status,
    numeroNfse: invoice.numeroNfse,
    numero: invoice.numeroNfse,
    serie: invoice.serie,
    chNFSe: invoice.chNfse,
    emittedAt: invoice.issuedAt ? new Date(invoice.issuedAt).toISOString() : null,
    ambiente: "estudo",
    aviso: STUDY_AVISO,
    pdfUrl: documents ? `${origin}/api/v1/invoices/${invoice.id}/pdf` : null,
    xmlUrl: documents ? `${origin}/api/v1/invoices/${invoice.id}/xml` : null,
    documentsCached: documents,
    errorCode: invoice.errorCode,
    errorMessage: invoice.errorMessage,
    cancelledAt: invoice.cancelledAt ? new Date(invoice.cancelledAt).toISOString() : null,
    cancelXmlUrl: invoice.status === "cancelled" ? `${origin}/api/v1/invoices/${invoice.id}/xml?type=cancel` : null,
    cancelamentoRecusado: invoice.cancelError,
    cenario: invoice.simResult,
    origemCenario: invoice.simSource,
    conclusaoPrevista: new Date(invoice.readyAt).toISOString(),
  };
}

export function createInvoice(input: {
  org: Org;
  project: Project;
  emit: EmitInput;
  sim: SimOverride;
  idempotencyKey?: string | null;
  now?: number;
}) {
  if (input.project.active !== 1) {
    throw new StudyError(422, "empresa_inativa", "A empresa está desativada.");
  }
  if (input.org.creditsUsed >= input.org.creditsLimit) {
    throw new StudyError(403, "cota_esgotada", "A cota de notas do plano de estudo acabou.");
  }
  const now = input.now ?? Date.now();
  const picked = pickResult({ forced: input.sim.resultado, failureRate: input.org.failureRate });
  const delay = pickDelay(input.org.latencyMinMs, input.org.latencyMaxMs, input.sim.atrasoMs);
  const times = schedule(now, delay);
  const { simulacao: _ignored, ...stored } = input.emit;
  if (stored.tomador.email === "") delete stored.tomador.email;
  const competencia = stored.competencia ?? competenciaAtual(new Date(now));
  const id = newId("inv");
  const row: Invoice = {
    id,
    organizationId: input.org.id,
    projectId: input.project.id,
    status: "queued",
    payloadJson: JSON.stringify({ ...stored, competencia }),
    tomadorNome: stored.tomador.nome,
    valorTotal: stored.valores.total,
    competencia,
    referencia: stored.referencia ?? null,
    timelineJson: JSON.stringify([
      {
        em: now,
        titulo: "Aceita na fila",
        detalhe: `A prefeitura simulada vai responder em cerca de ${delay} ms. Cenário ${picked.source}: ${picked.result}.`,
      },
    ] satisfies TimelineEvent[]),
    simResult: picked.result,
    simDelayMs: delay,
    simSource: picked.source,
    readyAt: times.readyAt,
    processAfter: times.processAfter,
    numeroNfse: null,
    serie: null,
    chNfse: null,
    errorCode: null,
    errorMessage: null,
    cancelMotivo: null,
    cancelCodigo: null,
    cancelResult: null,
    cancelDelayMs: null,
    cancelSource: null,
    cancelError: null,
    issuedAt: null,
    cancelledAt: null,
    idempotencyKey: input.idempotencyKey ?? null,
    createdAt: now,
    updatedAt: now,
  };
  getDb().db.insert(invoices).values(row).run();
  return {
    status: 202,
    body: {
      queued: true,
      invoiceId: id,
      status: "queued",
      pollUrl: `/api/v1/invoices/${id}/status`,
      aviso: STUDY_AVISO,
      cenario: picked.result,
      origemCenario: picked.source,
      atrasoMs: delay,
    },
    invoice: row,
  };
}

export function getInvoice(id: string, projectId?: string): Invoice | undefined {
  const where = projectId ? and(eq(invoices.id, id), eq(invoices.projectId, projectId)) : eq(invoices.id, id);
  return getDb().db.select().from(invoices).where(where).get();
}

export function getInvoiceInOrg(id: string, organizationId: string): Invoice | undefined {
  return getDb()
    .db.select()
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.organizationId, organizationId)))
    .get();
}

export function listInvoices(organizationId: string, filters: { status?: string; q?: string }) {
  const clauses = [eq(invoices.organizationId, organizationId)];
  if (filters.status) clauses.push(eq(invoices.status, filters.status));
  if (filters.q) {
    const safe = `%${filters.q.replace(/[%_]/g, "").slice(0, 80)}%`;
    clauses.push(
      or(
        like(invoices.tomadorNome, safe),
        like(invoices.numeroNfse, safe),
        like(invoices.referencia, safe),
        like(invoices.id, safe),
      )!,
    );
  }
  return getDb()
    .db.select()
    .from(invoices)
    .where(and(...clauses))
    .orderBy(desc(invoices.createdAt))
    .limit(80)
    .all();
}

export function requestCancel(input: {
  org: Org;
  project: Project;
  invoiceId: string;
  motivo?: string;
  codigoMotivo?: number;
  sim: SimOverride;
  now?: number;
}) {
  const invoice = getInvoice(input.invoiceId, input.project.id);
  if (!invoice) throw new StudyError(404, "nao_encontrado", "Nota não encontrada neste projeto.");
  if (invoice.status !== "issued") {
    throw new StudyError(422, "status_invalido", "Só uma nota emitida pode entrar na fila de cancelamento.");
  }
  if (input.motivo && (input.motivo.trim().length < 15 || input.motivo.trim().length > 255)) {
    throw new StudyError(422, "motivo_invalido", "O motivo, quando informado, precisa ter de 15 a 255 caracteres.", "motivo");
  }
  const now = input.now ?? Date.now();
  const picked = pickResult({ forced: input.sim.resultado, failureRate: input.org.failureRate });
  const delay = pickDelay(input.org.latencyMinMs, input.org.latencyMaxMs, input.sim.atrasoMs);
  const times = schedule(now, delay);
  const nextTimeline = pushTimeline(invoice.timelineJson, {
    em: now,
    titulo: "Cancelamento na fila",
    detalhe: `Pedido enviado à prefeitura simulada. Cenário ${picked.source}: ${picked.result}. Espera de ${delay} ms.`,
  });
  const updated = getDb()
    .db.update(invoices)
    .set({
      status: "cancel_queued",
      processAfter: times.processAfter,
      readyAt: times.readyAt,
      cancelMotivo: input.motivo?.trim() || null,
      cancelCodigo: input.codigoMotivo ?? null,
      cancelResult: picked.result,
      cancelDelayMs: delay,
      cancelSource: picked.source,
      cancelError: null,
      timelineJson: nextTimeline,
      updatedAt: now,
    })
    .where(and(eq(invoices.id, invoice.id), eq(invoices.status, "issued")))
    .run();
  if (updated.changes === 0) throw new StudyError(422, "status_invalido", "A nota mudou de estado antes do cancelamento.");
  return {
    status: 202,
    body: {
      queued: true,
      invoiceId: invoice.id,
      status: "cancel_queued",
      aviso: STUDY_AVISO,
      cenario: picked.result,
      atrasoMs: delay,
    },
  };
}

export function advanceDue(now = Date.now()): void {
  const due = getDb()
    .db.select()
    .from(invoices)
    .where(and(inArray(invoices.status, ["queued", "processing", "cancel_queued"]), lte(invoices.processAfter, now)))
    .limit(50)
    .all();
  for (const invoice of due) advanceOne(invoice, now);
}

function advanceOne(invoice: Invoice, now: number): void {
  if (invoice.status === "cancel_queued") {
    if (now >= invoice.readyAt) finalizeCancel(invoice, now);
    return;
  }
  if (now < invoice.readyAt && invoice.status === "queued") {
    const nextTimeline = pushTimeline(invoice.timelineJson, {
      em: now,
      titulo: "Prefeitura simulada em processamento",
      detalhe: "O autorizador de estudo recebeu a nota e ainda não devolveu o resultado.",
    });
    getDb()
      .db.update(invoices)
      .set({
        status: "processing",
        processAfter: invoice.readyAt,
        timelineJson: nextTimeline,
        updatedAt: now,
      })
      .where(and(eq(invoices.id, invoice.id), eq(invoices.status, "queued")))
      .run();
    return;
  }
  finalizeEmit(invoice, now);
}

function finalizeEmit(snapshot: Invoice, now: number): void {
  const { db } = getDb();
  const produced = db.transaction(() => {
    const invoice = db.select().from(invoices).where(eq(invoices.id, snapshot.id)).get();
    if (!invoice || (invoice.status !== "queued" && invoice.status !== "processing")) return null;
    const org = db.select().from(organizations).where(eq(organizations.id, invoice.organizationId)).get();
    const project = db.select().from(projects).where(eq(projects.id, invoice.projectId)).get();
    if (!org || !project) return null;
    const result = invoice.simResult as SimResult;
    if (result !== "sucesso") {
      const failure = FAILURES[result];
      const nextTimeline = pushTimeline(invoice.timelineJson, {
        em: now,
        titulo: "Falha simulada",
        detalhe: failure.message,
      });
      db.update(invoices)
        .set({
          status: "error",
          processAfter: null,
          errorCode: failure.code,
          errorMessage: failure.message,
          timelineJson: nextTimeline,
          updatedAt: now,
        })
        .where(eq(invoices.id, invoice.id))
        .run();
      return { kind: "error" as const, invoiceId: invoice.id, org, project, failure };
    }
    if (org.creditsUsed >= org.creditsLimit) {
      const nextTimeline = pushTimeline(invoice.timelineJson, {
        em: now,
        titulo: "Cota esgotada",
        detalhe: QUOTA_ERROR.message,
      });
      db.update(invoices)
        .set({
          status: "error",
          processAfter: null,
          errorCode: QUOTA_ERROR.code,
          errorMessage: QUOTA_ERROR.message,
          timelineJson: nextTimeline,
          updatedAt: now,
        })
        .where(eq(invoices.id, invoice.id))
        .run();
      return {
        kind: "error" as const,
        invoiceId: invoice.id,
        org,
        project,
        failure: QUOTA_ERROR,
      };
    }
    const numero = project.ultimoNumeroNfse + 1;
    const numeroNfse = String(numero).padStart(6, "0");
    const chNfse = `ESTUDO-${project.serieNfse}-${numeroNfse}`;
    const nextTimeline = pushTimeline(invoice.timelineJson, {
      em: now,
      titulo: "NFS-e de estudo emitida",
      detalhe: `Número ${numeroNfse}. Código interno ${chNfse}. Sem transmissão oficial.`,
    });
    db.update(projects)
      .set({ ultimoNumeroNfse: numero, updatedAt: now })
      .where(eq(projects.id, project.id))
      .run();
    db.update(organizations)
      .set({ creditsUsed: sql`${organizations.creditsUsed} + 1` })
      .where(eq(organizations.id, org.id))
      .run();
    db.update(invoices)
      .set({
        status: "issued",
        processAfter: null,
        numeroNfse,
        serie: project.serieNfse,
        chNfse,
        issuedAt: now,
        timelineJson: nextTimeline,
        updatedAt: now,
      })
      .where(eq(invoices.id, invoice.id))
      .run();
    const payload = parseJson<{ tomador?: { email?: string; nome?: string } }>(invoice.payloadJson, {});
    if (payload.tomador?.email) {
      db.insert(emailOutbox)
        .values({
          id: newId("mail"),
          organizationId: org.id,
          invoiceId: invoice.id,
          toEmail: payload.tomador.email,
          subject: `NFS-e de estudo nº ${numeroNfse} — sem valor fiscal`,
          body: `Olá. Esta mensagem ficou só na caixa de saída da bancada. A nota ${numeroNfse} (${chNfse}) não foi enviada por SMTP nem a um órgão público. ${STUDY_AVISO}`,
          createdAt: now,
        })
        .run();
    }
    return { kind: "issued" as const, invoiceId: invoice.id, org, project, numeroNfse, chNfse, valor: invoice.valorTotal };
  });
  if (!produced) return;
  if (produced.kind === "error") {
    enqueueEvent({
      organizationId: produced.org.id,
      projectId: produced.project.id,
      invoiceId: produced.invoiceId,
      event: "nfse.error",
      dados: {
        id: produced.invoiceId,
        status: "error",
        errorCode: produced.failure.code,
        errorMessage: produced.failure.message,
      },
      when: now,
    });
    return;
  }
  const dados = {
    id: produced.invoiceId,
    numero: produced.numeroNfse,
    status: "issued",
    chNFSe: produced.chNfse,
    valorTotal: produced.valor,
  };
  enqueueEvent({
    organizationId: produced.org.id,
    projectId: produced.project.id,
    invoiceId: produced.invoiceId,
    event: "nfse.issued",
    dados,
    when: now,
  });
  const docDelay = snapshot.simDelayMs === 0 ? 0 : 1000;
  enqueueEvent({
    organizationId: produced.org.id,
    projectId: produced.project.id,
    invoiceId: produced.invoiceId,
    event: "nfse.documents_ready",
    dados: { ...dados, documentStatus: "complete" },
    when: now + docDelay,
  });
}

function finalizeCancel(snapshot: Invoice, now: number): void {
  const { db } = getDb();
  const produced = db.transaction(() => {
    const invoice = db.select().from(invoices).where(eq(invoices.id, snapshot.id)).get();
    if (!invoice || invoice.status !== "cancel_queued") return null;
    const org = db.select().from(organizations).where(eq(organizations.id, invoice.organizationId)).get();
    const project = db.select().from(projects).where(eq(projects.id, invoice.projectId)).get();
    if (!org || !project) return null;
    const result = (invoice.cancelResult ?? "sucesso") as SimResult;
    if (result !== "sucesso") {
      const message = CANCEL_FAILURES[result];
      const nextTimeline = pushTimeline(invoice.timelineJson, {
        em: now,
        titulo: "Cancelamento recusado",
        detalhe: message,
      });
      db.update(invoices)
        .set({
          status: "issued",
          processAfter: null,
          cancelError: message,
          timelineJson: nextTimeline,
          updatedAt: now,
        })
        .where(eq(invoices.id, invoice.id))
        .run();
      return null;
    }
    const nextTimeline = pushTimeline(invoice.timelineJson, {
      em: now,
      titulo: "Cancelada no simulador",
      detalhe: "A prefeitura de estudo aceitou o cancelamento. A nota continua sem valor fiscal.",
    });
    db.update(invoices)
      .set({
        status: "cancelled",
        processAfter: null,
        cancelledAt: now,
        timelineJson: nextTimeline,
        updatedAt: now,
      })
      .where(eq(invoices.id, invoice.id))
      .run();
    return { invoice, org, project };
  });
  if (!produced) return;
  enqueueEvent({
    organizationId: produced.org.id,
    projectId: produced.project.id,
    invoiceId: produced.invoice.id,
    event: "nfse.cancelled",
    dados: {
      id: produced.invoice.id,
      numeroNfse: produced.invoice.numeroNfse,
      status: "cancelled",
      cancelledAt: new Date(now).toISOString(),
    },
    when: now,
  });
}

export function invoiceTimeline(invoice: Invoice): TimelineEvent[] {
  return timeline(invoice);
}
