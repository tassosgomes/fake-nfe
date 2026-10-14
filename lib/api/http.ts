import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { apiKeys, idempotency, organizations, projects } from "../db/schema";
import { sha256 } from "../crypto";
import { StudyError } from "../errors";
import { newId } from "../ids";
import { STUDY_AVISO } from "../plan";
import { findKey, touchKey } from "../services/keys";
import { countRecent, writeLog } from "../services/logs";
import { startSweeper } from "../simulation/sweeper";

export function studyJson(data: unknown, status = 200, extra?: HeadersInit): Response {
  const headers = new Headers(extra);
  headers.set("X-Ambiente", "estudo");
  headers.set("X-Aviso", "sem-valor-fiscal");
  return Response.json(data, { status, headers });
}

export const CORRELATION_HEADER = "X-Correlation-Id";

const CORRELATION_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

export function correlationIdOf(req: Request): string {
  const incoming = req.headers.get(CORRELATION_HEADER)?.trim() ?? "";
  return CORRELATION_PATTERN.test(incoming) ? incoming : randomUUID();
}

function withCorrelation(response: Response, correlationId: string): Response {
  response.headers.set(CORRELATION_HEADER, correlationId);
  return response;
}

const PROBLEM_TITLES: Record<number, string> = {
  400: "Requisição inválida",
  401: "Não autenticado",
  403: "Acesso negado",
  404: "Não encontrado",
  409: "Conflito",
  413: "Conteúdo grande demais",
  422: "Regra de negócio violada",
  429: "Limite de requisições atingido",
  500: "Erro interno",
  503: "Serviço indisponível",
};

// RFC 9457. `code`, `campo`, `correlationId` e `aviso` são membros de extensão.
export function studyError(
  error: StudyError,
  context: { instance: string; correlationId: string },
  extra?: HeadersInit,
): Response {
  const headers = new Headers(extra);
  headers.set("Content-Type", "application/problem+json");
  return studyJson(
    {
      type: `urn:bancada-nfse:problema:${error.code}`,
      title: PROBLEM_TITLES[error.status] ?? "Erro",
      status: error.status,
      detail: error.message,
      instance: context.instance,
      code: error.code,
      campo: error.campo ?? null,
      correlationId: context.correlationId,
      aviso: STUDY_AVISO,
    },
    error.status,
    headers,
  );
}

export function studyBinary(
  body: BodyInit,
  contentType: string,
  filename: string,
  disposition: "inline" | "attachment",
): Response {
  return new Response(body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `${disposition}; filename="${filename}"`,
      "Cache-Control": "no-store",
      "X-Ambiente": "estudo",
      "X-Aviso": "sem-valor-fiscal",
    },
  });
}

export type ProjectAuth = {
  kind: "project";
  tokenPrefix: string;
  keyId: string;
  organization: typeof organizations.$inferSelect;
  project: typeof projects.$inferSelect;
  scopes: string[];
};

export type OrgAuth = {
  kind: "org";
  tokenPrefix: string;
  keyId: string;
  organization: typeof organizations.$inferSelect;
  scopes: string[];
};

type LogAuth = {
  keyId?: string;
  tokenPrefix?: string;
  organizationId?: string;
  projectId?: string;
};

function pathOf(req: Request): string {
  return new URL(req.url).pathname;
}

function logResponse(req: Request, auth: LogAuth | null, started: number, response: Response): Response {
  writeLog({
    organizationId: auth?.organizationId,
    projectId: auth?.projectId,
    apiKeyId: auth?.keyId,
    keyPrefix: auth?.tokenPrefix,
    method: req.method,
    path: pathOf(req),
    statusCode: response.status,
    durationMs: Date.now() - started,
  });
  return response;
}

function fail(status: number, code: string, message: string): StudyError {
  return new StudyError(status, code, message);
}

export async function withProject(
  req: Request,
  scope: string,
  handler: (auth: ProjectAuth, body: unknown, req: Request) => Promise<Response> | Response,
  options?: { idempotent?: boolean },
): Promise<Response> {
  return run(req, () => authorizeProject(req, scope), async (auth) => {
    const raw = await readBody(req);
    if (options?.idempotent) {
      const replay = takeIdempotency(req, auth.project.id, raw);
      if (replay) return replay;
    }
    touchKey(auth.keyId);
    const response = await handler(auth, raw.body, req);
    if (options?.idempotent && raw.idemKey && response.status < 500) {
      await saveIdempotency(auth.project.id, raw.idemKey, req, raw.raw, response);
    }
    return response;
  });
}

export async function withOrg(
  req: Request,
  scope: string,
  handler: (auth: OrgAuth, body: unknown, req: Request) => Promise<Response> | Response,
): Promise<Response> {
  return run(req, () => authorizeOrg(req, scope), async (auth) => {
    const raw = await readBody(req);
    touchKey(auth.keyId);
    return handler(auth, raw.body, req);
  });
}

async function run<T extends ProjectAuth | OrgAuth>(
  req: Request,
  authorize: () => T,
  handler: (auth: T) => Promise<Response>,
): Promise<Response> {
  const started = Date.now();
  const context = { instance: pathOf(req), correlationId: correlationIdOf(req) };
  let auth: T | null = null;
  startSweeper();
  try {
    auth = authorize();
    const limited = enforceRate(auth, context);
    if (limited) return withCorrelation(logResponse(req, toLog(auth), started, limited), context.correlationId);
    const response = await handler(auth);
    return withCorrelation(logResponse(req, toLog(auth), started, response), context.correlationId);
  } catch (error) {
    const response = studyError(asStudyError(error), context);
    return withCorrelation(logResponse(req, auth ? toLog(auth) : null, started, response), context.correlationId);
  }
}

function asStudyError(error: unknown): StudyError {
  if (error instanceof StudyError) return error;
  console.error(error);
  return new StudyError(500, "erro_interno", "Falha interna da bancada.");
}

// Rotas sem autenticação, rate limit nem log de acesso, como o health check.
export async function withPublic(req: Request, handler: (req: Request) => Promise<Response> | Response): Promise<Response> {
  const context = { instance: pathOf(req), correlationId: correlationIdOf(req) };
  startSweeper();
  try {
    return withCorrelation(await handler(req), context.correlationId);
  } catch (error) {
    return withCorrelation(studyError(asStudyError(error), context), context.correlationId);
  }
}

function toLog(auth: ProjectAuth | OrgAuth): LogAuth {
  return {
    keyId: auth.keyId,
    tokenPrefix: auth.tokenPrefix,
    organizationId: auth.organization.id,
    projectId: auth.kind === "project" ? auth.project.id : undefined,
  };
}

function authorizeProject(req: Request, scope: string): ProjectAuth {
  const token = req.headers.get("x-api-key")?.trim() ?? "";
  if (!token) throw fail(401, "nao_autorizado", "Informe o header x-api-key.");
  if (token.startsWith("ntaas_org_")) throw fail(403, "tipo_de_chave", "Esta rota aceita chave de projeto (prefixo ntaas_).");
  if (!token.startsWith("ntaas_")) throw fail(401, "nao_autorizado", "Chave inválida.");
  const key = findKey(token);
  if (!key) throw fail(401, "nao_autorizado", "Chave inválida.");
  if (key.active !== 1 || key.kind !== "project" || !key.projectId) {
    throw fail(403, "chave_revogada", "Chave revogada ou sem permissão.");
  }
  const scopes = JSON.parse(key.scopesJson) as string[];
  if (!scopes.includes(scope)) throw fail(403, "escopo", "A chave não tem o escopo pedido.");
  const project = getDb().db.select().from(projects).where(eq(projects.id, key.projectId)).get();
  const organization = project
    ? getDb().db.select().from(organizations).where(eq(organizations.id, project.organizationId)).get()
    : undefined;
  if (!project || !organization) throw fail(403, "projeto_ausente", "Projeto da chave não existe.");
  return { kind: "project", tokenPrefix: key.keyPrefix, keyId: key.id, organization, project, scopes };
}

function authorizeOrg(req: Request, scope: string): OrgAuth {
  const token = req.headers.get("x-api-key")?.trim() ?? "";
  if (!token.startsWith("ntaas_org_")) throw fail(403, "tipo_de_chave", "Esta rota aceita token de organização (prefixo ntaas_org_).");
  const key = findKey(token);
  if (!key || key.kind !== "org") throw fail(401, "nao_autorizado", "Token inválido.");
  if (key.active !== 1) throw fail(403, "chave_revogada", "Token revogado.");
  const scopes = JSON.parse(key.scopesJson) as string[];
  if (!scopes.includes(scope)) throw fail(403, "escopo", "O token não tem o escopo pedido.");
  const organization = getDb().db.select().from(organizations).where(eq(organizations.id, key.organizationId)).get();
  if (!organization) throw fail(403, "organizacao_ausente", "Organização não encontrada.");
  return { kind: "org", tokenPrefix: key.keyPrefix, keyId: key.id, organization, scopes };
}

function enforceRate(
  auth: ProjectAuth | OrgAuth,
  context: { instance: string; correlationId: string },
): Response | null {
  const key = getDb().db.select().from(apiKeys).where(eq(apiKeys.id, auth.keyId)).get();
  const limit = key?.rateLimitPerMinute ?? 60;
  if (countRecent(auth.keyId, Date.now() - 60_000) < limit) return null;
  return studyError(new StudyError(429, "rate_limit", "Limite de requisições por minuto atingido."), context, {
    "Retry-After": "60",
  });
}

async function readBody(req: Request): Promise<{ body: unknown; raw: string; idemKey: string | null }> {
  const idemKey = req.headers.get("idempotency-key");
  if (idemKey && !/^[A-Za-z0-9_-]{1,80}$/.test(idemKey)) {
    throw new StudyError(400, "idempotency_invalida", "Idempotency-Key aceita até 80 caracteres [A-Za-z0-9_-].");
  }
  if (req.method === "GET" || req.method === "DELETE") return { body: null, raw: "", idemKey };
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) return { body: null, raw: "", idemKey };
  const raw = await req.text();
  if (!raw) return { body: {}, raw: "", idemKey };
  try {
    return { body: JSON.parse(raw), raw, idemKey };
  } catch {
    throw new StudyError(400, "json_invalido", "O corpo precisa ser JSON.");
  }
}

function takeIdempotency(req: Request, scopeId: string, raw: { raw: string; idemKey: string | null }): Response | null {
  if (!raw.idemKey) return null;
  const found = getDb()
    .db.select()
    .from(idempotency)
    .where(and(eq(idempotency.scopeId, scopeId), eq(idempotency.idemKey, raw.idemKey)))
    .get();
  if (!found) return null;
  const path = pathOf(req);
  if (found.method !== req.method || found.path !== path || found.bodyHash !== sha256(raw.raw)) {
    throw new StudyError(409, "idempotency_conflito", "Esta Idempotency-Key já foi usada com outro pedido.");
  }
  return new Response(found.responseJson, {
    status: found.statusCode,
    headers: {
      "Content-Type": "application/json",
      "Idempotent-Replayed": "true",
      "X-Ambiente": "estudo",
      "X-Aviso": "sem-valor-fiscal",
    },
  });
}

async function saveIdempotency(scopeId: string, idemKey: string, req: Request, raw: string, response: Response): Promise<void> {
  const text = await response.clone().text();
  try {
    getDb()
      .db.insert(idempotency)
      .values({
        id: newId("idem"),
        scopeId,
        idemKey,
        method: req.method,
        path: pathOf(req),
        bodyHash: sha256(raw),
        statusCode: response.status,
        responseJson: text,
        createdAt: Date.now(),
      })
      .run();
  } catch {
    // Outra requisição gravou a mesma chave primeiro.
  }
}
