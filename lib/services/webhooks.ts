import { and, desc, eq, lte } from "drizzle-orm";
import { getDb } from "../db/client";
import { organizations, webhookDeliveries, webhookEndpoints } from "../db/schema";
import { StudyError } from "../errors";
import { signBody } from "../crypto";
import { newId } from "../ids";
import { parseJson } from "../format";
import { DEFAULT_RETRIES, NFSE_EVENTS, STUDY_AVISO, type NfseEvent } from "../plan";
import { webhookUrlAllowed } from "../simulation/decide";

export function assertWebhookUrl(url: string): void {
  if (!webhookUrlAllowed(url)) {
    throw new StudyError(400, "url_invalida", "A URL do webhook precisa ser http(s). Localhost é aceito neste laboratório.", "url");
  }
}

export function createEndpoint(input: {
  organizationId: string;
  projectId: string;
  url: string;
  events: string[];
  secret?: string | null;
  active?: boolean;
}) {
  assertWebhookUrl(input.url);
  const unknown = input.events.filter((event) => !NFSE_EVENTS.includes(event as NfseEvent));
  if (unknown.length || input.events.length === 0) {
    throw new StudyError(400, "evento_invalido", "Informe ao menos um evento de NFS-e de estudo.", "events");
  }
  const now = Date.now();
  const row = {
    id: newId("wh"),
    organizationId: input.organizationId,
    projectId: input.projectId,
    url: input.url,
    eventsJson: JSON.stringify(input.events),
    secret: input.secret?.trim() ? input.secret.trim() : null,
    active: input.active === false ? 0 : 1,
    createdAt: now,
  };
  getDb().db.insert(webhookEndpoints).values(row).run();
  return row;
}

export function listEndpoints(projectId: string) {
  return getDb()
    .db.select()
    .from(webhookEndpoints)
    .where(eq(webhookEndpoints.projectId, projectId))
    .orderBy(desc(webhookEndpoints.createdAt))
    .all();
}

export function listEndpointsByOrg(organizationId: string) {
  return getDb()
    .db.select()
    .from(webhookEndpoints)
    .where(eq(webhookEndpoints.organizationId, organizationId))
    .orderBy(desc(webhookEndpoints.createdAt))
    .all();
}

export function updateEndpoint(
  endpointId: string,
  projectId: string,
  patch: { url?: string; events?: string[]; secret?: string | null; active?: boolean },
) {
  const current = getDb()
    .db.select()
    .from(webhookEndpoints)
    .where(and(eq(webhookEndpoints.id, endpointId), eq(webhookEndpoints.projectId, projectId)))
    .get();
  if (!current) throw new StudyError(404, "nao_encontrado", "Webhook não encontrado.");
  if (patch.url) assertWebhookUrl(patch.url);
  if (patch.events) {
    const unknown = patch.events.filter((event) => !NFSE_EVENTS.includes(event as NfseEvent));
    if (unknown.length || patch.events.length === 0) {
      throw new StudyError(400, "evento_invalido", "Lista de eventos inválida.", "events");
    }
  }
  const secret =
    patch.secret === undefined ? current.secret : patch.secret === null || patch.secret === "" ? null : patch.secret;
  getDb()
    .db.update(webhookEndpoints)
    .set({
      url: patch.url ?? current.url,
      eventsJson: patch.events ? JSON.stringify(patch.events) : current.eventsJson,
      secret,
      active: patch.active == null ? current.active : patch.active ? 1 : 0,
    })
    .where(eq(webhookEndpoints.id, endpointId))
    .run();
  return getDb().db.select().from(webhookEndpoints).where(eq(webhookEndpoints.id, endpointId)).get()!;
}

export function deleteEndpoint(endpointId: string, projectId: string): void {
  const result = getDb()
    .db.delete(webhookEndpoints)
    .where(and(eq(webhookEndpoints.id, endpointId), eq(webhookEndpoints.projectId, projectId)))
    .run();
  if (result.changes === 0) throw new StudyError(404, "nao_encontrado", "Webhook não encontrado.");
}

export function enqueueEvent(input: {
  organizationId: string;
  projectId: string;
  invoiceId?: string | null;
  event: NfseEvent;
  dados: Record<string, unknown>;
  when?: number;
}): void {
  const endpoints = listEndpoints(input.projectId).filter((item) => item.active === 1);
  const now = input.when ?? Date.now();
  for (const endpoint of endpoints) {
    const events = parseJson<string[]>(endpoint.eventsJson, []);
    if (!events.includes(input.event)) continue;
    const payload = {
      evento: input.event,
      timestamp: new Date(now).toISOString(),
      aviso: STUDY_AVISO,
      dados: input.dados,
    };
    getDb()
      .db.insert(webhookDeliveries)
      .values({
        id: newId("del"),
        endpointId: endpoint.id,
        organizationId: input.organizationId,
        projectId: input.projectId,
        invoiceId: input.invoiceId ?? null,
        event: input.event,
        url: endpoint.url,
        payloadJson: JSON.stringify(payload),
        status: "pending",
        attempts: 0,
        nextAttemptAt: now,
        createdAt: now,
      })
      .run();
  }
}

export function enqueueTest(endpointId: string, projectId: string) {
  const endpoint = getDb()
    .db.select()
    .from(webhookEndpoints)
    .where(and(eq(webhookEndpoints.id, endpointId), eq(webhookEndpoints.projectId, projectId)))
    .get();
  if (!endpoint) throw new StudyError(404, "nao_encontrado", "Webhook não encontrado.");
  const events = parseJson<string[]>(endpoint.eventsJson, []);
  if (!events.includes("nfse.issued")) {
    throw new StudyError(422, "evento_ausente", "Inclua nfse.issued para receber o evento de teste.");
  }
  const now = Date.now();
  const payload = {
    evento: "nfse.issued",
    timestamp: new Date(now).toISOString(),
    aviso: STUDY_AVISO,
    teste: true,
    dados: {
      id: "inv_teste",
      numero: "000000",
      status: "issued",
      chNFSe: "ESTUDO-TESTE-000000",
      valorTotal: 1,
    },
  };
  const id = newId("del");
  getDb()
    .db.insert(webhookDeliveries)
    .values({
      id,
      endpointId: endpoint.id,
      organizationId: endpoint.organizationId,
      projectId: endpoint.projectId,
      invoiceId: null,
      event: "nfse.issued",
      url: endpoint.url,
      payloadJson: JSON.stringify(payload),
      status: "pending",
      attempts: 0,
      nextAttemptAt: now,
      createdAt: now,
    })
    .run();
  return { queued: true, deliveryId: id };
}

export function listDeliveries(organizationId: string, projectId?: string, limit = 50) {
  const where = projectId
    ? and(eq(webhookDeliveries.organizationId, organizationId), eq(webhookDeliveries.projectId, projectId))
    : eq(webhookDeliveries.organizationId, organizationId);
  return getDb()
    .db.select()
    .from(webhookDeliveries)
    .where(where)
    .orderBy(desc(webhookDeliveries.createdAt))
    .limit(limit)
    .all();
}

function retryDelays(organizationId: string): number[] {
  const org = getDb().db.select().from(organizations).where(eq(organizations.id, organizationId)).get();
  const parsed = parseJson<number[]>(org?.retryDelaysJson, DEFAULT_RETRIES);
  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "number")) return DEFAULT_RETRIES;
  return parsed;
}

export async function deliverDue(now = Date.now()): Promise<void> {
  const due = getDb()
    .db.select()
    .from(webhookDeliveries)
    .where(and(eq(webhookDeliveries.status, "pending"), lte(webhookDeliveries.nextAttemptAt, now)))
    .limit(20)
    .all();
  for (const delivery of due) {
    await attemptDelivery(delivery, now);
  }
}

async function attemptDelivery(
  delivery: typeof webhookDeliveries.$inferSelect,
  now: number,
): Promise<void> {
  const endpoint = getDb().db.select().from(webhookEndpoints).where(eq(webhookEndpoints.id, delivery.endpointId)).get();
  const secret = endpoint?.secret;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Notaas-Event": delivery.event,
    "X-Notaas-Delivery": delivery.id,
    "X-Ambiente": "estudo",
  };
  if (secret) headers["X-Notaas-Signature"] = signBody(secret, delivery.payloadJson);
  let statusCode: number | null = null;
  let error: string | null = null;
  try {
    const response = await fetch(delivery.url, {
      method: "POST",
      headers,
      body: delivery.payloadJson,
      signal: AbortSignal.timeout(10_000),
    });
    statusCode = response.status;
    if (!response.ok) error = `HTTP ${response.status}`;
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "falha de rede";
  }
  const attempts = delivery.attempts + 1;
  if (!error) {
    getDb()
      .db.update(webhookDeliveries)
      .set({ status: "success", attempts, lastStatusCode: statusCode, lastError: null })
      .where(eq(webhookDeliveries.id, delivery.id))
      .run();
    return;
  }
  const delays = retryDelays(delivery.organizationId);
  if (attempts > delays.length) {
    getDb()
      .db.update(webhookDeliveries)
      .set({ status: "failed", attempts, lastStatusCode: statusCode, lastError: error })
      .where(eq(webhookDeliveries.id, delivery.id))
      .run();
    return;
  }
  getDb()
    .db.update(webhookDeliveries)
    .set({
      status: "pending",
      attempts,
      lastStatusCode: statusCode,
      lastError: error,
      nextAttemptAt: now + delays[attempts - 1],
    })
    .where(eq(webhookDeliveries.id, delivery.id))
    .run();
}

export function publicEndpoint(row: typeof webhookEndpoints.$inferSelect) {
  return {
    id: row.id,
    projectId: row.projectId,
    url: row.url,
    events: parseJson<string[]>(row.eventsJson, []),
    hasSecret: Boolean(row.secret),
    active: row.active === 1,
    createdAt: new Date(row.createdAt).toISOString(),
  };
}
