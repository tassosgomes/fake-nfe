import { eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { organizations } from "../db/schema";
import { StudyError } from "../errors";
import { parseJson } from "../format";
import { DEFAULT_RETRIES } from "../plan";
import { pickResult } from "../simulation/decide";

export function updateSimulation(
  organizationId: string,
  input: { latencyMinMs: number; latencyMaxMs: number; failureRate: number; retries: number[] },
) {
  if (input.latencyMinMs < 0 || input.latencyMaxMs > 120_000 || input.latencyMinMs > input.latencyMaxMs) {
    throw new StudyError(400, "atraso_invalido", "O atraso mínimo e o máximo precisam ficar entre 0 e 120000, com mínimo menor ou igual ao máximo.");
  }
  if (input.failureRate < 0 || input.failureRate > 100) {
    throw new StudyError(400, "taxa_invalida", "A chance de falha fica entre 0 e 100.");
  }
  if (input.retries.length !== 3 || input.retries.some((item) => item < 0 || item > 120_000)) {
    throw new StudyError(400, "retry_invalido", "Informe três esperas de retentativa, cada uma entre 0 e 120000 ms.");
  }
  getDb()
    .db.update(organizations)
    .set({
      latencyMinMs: Math.round(input.latencyMinMs),
      latencyMaxMs: Math.round(input.latencyMaxMs),
      failureRate: Math.round(input.failureRate),
      retryDelaysJson: JSON.stringify(input.retries.map((item) => Math.round(item))),
    })
    .where(eq(organizations.id, organizationId))
    .run();
}

export function updateStorage(organizationId: string, storageBaseUrl: string | null) {
  if (storageBaseUrl) {
    let url: URL;
    try {
      url = new URL(storageBaseUrl);
    } catch {
      throw new StudyError(400, "url_invalida", "Informe uma URL https.", "storageBaseUrl");
    }
    if (url.protocol !== "https:") {
      throw new StudyError(400, "url_invalida", "O domínio de estudo precisa usar https.", "storageBaseUrl");
    }
  }
  getDb()
    .db.update(organizations)
    .set({
      storageBaseUrl,
      storageStatus: storageBaseUrl ? "pending_verification" : "none",
    })
    .where(eq(organizations.id, organizationId))
    .run();
  return {
    storageBaseUrl,
    status: storageBaseUrl ? "pending_verification" : "none",
    message: storageBaseUrl
      ? "Verificação simulada pendente. Nenhum DNS foi consultado."
      : "Domínio removido.",
  };
}

export function simulateVerification(organizationId: string) {
  const org = getDb().db.select().from(organizations).where(eq(organizations.id, organizationId)).get();
  if (!org?.storageBaseUrl) throw new StudyError(422, "sem_dominio", "Cadastre um domínio antes de simular a verificação.");
  getDb().db.update(organizations).set({ storageStatus: "verified" }).where(eq(organizations.id, organizationId)).run();
  return { storageBaseUrl: org.storageBaseUrl, status: "verified", message: "Verificação simulada. Nenhum CNAME foi checado." };
}

export function sampleRolls(organizationId: string, count = 10) {
  const org = getDb().db.select().from(organizations).where(eq(organizations.id, organizationId)).get();
  if (!org) throw new StudyError(404, "nao_encontrado", "Organização não encontrada.");
  return Array.from({ length: count }, () => pickResult({ failureRate: org.failureRate }).result);
}

export function retryOf(organizationId: string): number[] {
  const org = getDb().db.select().from(organizations).where(eq(organizations.id, organizationId)).get();
  return parseJson<number[]>(org?.retryDelaysJson, DEFAULT_RETRIES);
}

export function publicSettings(org: typeof organizations.$inferSelect) {
  return {
    name: org.name,
    slug: org.slug,
    planName: "Estudo",
    creditsUsed: org.creditsUsed,
    creditsLimit: org.creditsLimit,
    projectLimit: org.projectLimit,
    latencyMinMs: org.latencyMinMs,
    latencyMaxMs: org.latencyMaxMs,
    failureRate: org.failureRate,
    retries: parseJson<number[]>(org.retryDelaysJson, DEFAULT_RETRIES),
    storageBaseUrl: org.storageBaseUrl,
    storageStatus: org.storageStatus,
  };
}
