import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { apiKeys } from "../db/schema";
import { sha256 } from "../crypto";
import { StudyError } from "../errors";
import { newId, newToken } from "../ids";
import { STUDY_PLAN } from "../plan";

const PROJECT_SCOPES = ["emit", "cancel", "query", "webhooks"];
const ORG_SCOPES = ["projects:read", "projects:write", "api_keys:manage", "settings:read", "settings:write", "certificates:write"];

export function createApiKey(input: {
  organizationId: string;
  projectId?: string | null;
  kind: "project" | "org";
  name: string;
  rateLimitPerMinute?: number;
}) {
  if (input.kind === "project" && !input.projectId) {
    throw new StudyError(400, "projeto_obrigatorio", "A chave de projeto precisa de uma empresa.", "projectId");
  }
  const token = input.kind === "org" ? newToken("ntaas_org_") : newToken("ntaas_");
  const limit = input.rateLimitPerMinute ?? (input.kind === "org" ? STUDY_PLAN.orgRateLimit : STUDY_PLAN.projectRateLimit);
  if (limit < 1 || limit > 600) throw new StudyError(400, "limite_invalido", "O rate limit fica entre 1 e 600 por minuto.");
  const now = Date.now();
  const row = {
    id: newId("key"),
    organizationId: input.organizationId,
    projectId: input.kind === "project" ? input.projectId! : null,
    kind: input.kind,
    name: input.name.trim(),
    keyHash: sha256(token),
    keyPrefix: token.slice(0, input.kind === "org" ? 14 : 10),
    scopesJson: JSON.stringify(input.kind === "org" ? ORG_SCOPES : PROJECT_SCOPES),
    rateLimitPerMinute: Math.round(limit),
    active: 1,
    lastUsedAt: null,
    createdAt: now,
  };
  getDb().db.insert(apiKeys).values(row).run();
  return { ...row, key: token };
}

export function listKeys(organizationId: string, projectId?: string) {
  const where = projectId
    ? and(eq(apiKeys.organizationId, organizationId), eq(apiKeys.projectId, projectId))
    : eq(apiKeys.organizationId, organizationId);
  return getDb().db.select().from(apiKeys).where(where).orderBy(desc(apiKeys.createdAt)).all();
}

export function revokeKey(id: string, organizationId: string): void {
  const result = getDb()
    .db.update(apiKeys)
    .set({ active: 0 })
    .where(and(eq(apiKeys.id, id), eq(apiKeys.organizationId, organizationId), eq(apiKeys.active, 1)))
    .run();
  if (result.changes === 0) throw new StudyError(404, "nao_encontrado", "Chave não encontrada ou já revogada.");
}

export function revokeProjectKeys(projectId: string): void {
  getDb().db.update(apiKeys).set({ active: 0 }).where(eq(apiKeys.projectId, projectId)).run();
}

export function findKey(token: string) {
  return getDb().db.select().from(apiKeys).where(eq(apiKeys.keyHash, sha256(token))).get();
}

export function touchKey(id: string, now = Date.now()): void {
  getDb().db.update(apiKeys).set({ lastUsedAt: now }).where(eq(apiKeys.id, id)).run();
}

export function publicKey(row: typeof apiKeys.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    projectId: row.projectId,
    keyPrefix: row.keyPrefix,
    scopes: JSON.parse(row.scopesJson) as string[],
    rateLimitPerMinute: row.rateLimitPerMinute,
    active: row.active === 1,
    lastUsedAt: row.lastUsedAt ? new Date(row.lastUsedAt).toISOString() : null,
    createdAt: new Date(row.createdAt).toISOString(),
  };
}
