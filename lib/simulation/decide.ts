import { SIM_RESULTS, type SimResult } from "../plan";

const RESULTS = new Set<string>(SIM_RESULTS);

export type SimOverride = {
  resultado?: SimResult;
  atrasoMs?: number;
};

export function isSimResult(value: string): value is SimResult {
  return RESULTS.has(value);
}

export function parseSimObject(input: unknown): SimOverride | { error: string } {
  if (input == null) return {};
  if (typeof input !== "object" || Array.isArray(input)) {
    return { error: "simulacao precisa ser um objeto" };
  }
  const record = input as Record<string, unknown>;
  const override: SimOverride = {};
  if (record.resultado != null) {
    if (typeof record.resultado !== "string" || !isSimResult(record.resultado)) {
      return { error: "simulacao.resultado deve ser sucesso, rejeicao, timeout ou indisponivel" };
    }
    override.resultado = record.resultado;
  }
  if (record.atrasoMs != null) {
    const delay = Number(record.atrasoMs);
    if (!Number.isFinite(delay) || delay < 0 || delay > 120_000) {
      return { error: "simulacao.atrasoMs deve ficar entre 0 e 120000" };
    }
    override.atrasoMs = Math.round(delay);
  }
  return override;
}

export function parseSimHeader(value: string | null): SimOverride | { error: string } | null {
  if (!value || !value.trim()) return null;
  const trimmed = value.trim();
  if (trimmed.startsWith("{")) {
    try {
      return parseSimObject(JSON.parse(trimmed));
    } catch {
      return { error: "X-Simulacao não é JSON válido" };
    }
  }
  const [resultado, ms] = trimmed.split(":");
  return parseSimObject({
    resultado,
    atrasoMs: ms == null || ms === "" ? undefined : Number(ms),
  });
}

export function mergeSim(
  header: SimOverride | { error: string } | null,
  body: SimOverride | { error: string } | undefined,
): SimOverride | { error: string } {
  if (header && "error" in header) return header;
  if (body && "error" in body) return body;
  return { ...(header ?? {}), ...(body ?? {}) };
}

export function pickResult(options: {
  forced?: SimResult;
  failureRate: number;
  random?: () => number;
}): { result: SimResult; source: "forcado" | "sorteado" } {
  if (options.forced) return { result: options.forced, source: "forcado" };
  const random = options.random ?? Math.random;
  const rate = Math.min(100, Math.max(0, options.failureRate));
  if (random() * 100 >= rate) return { result: "sucesso", source: "sorteado" };
  const kinds: Array<Exclude<SimResult, "sucesso">> = ["rejeicao", "timeout", "indisponivel"];
  const index = Math.min(kinds.length - 1, Math.floor(random() * kinds.length));
  return { result: kinds[index], source: "sorteado" };
}

export function pickDelay(min: number, max: number, forced?: number, random = Math.random): number {
  if (typeof forced === "number") return Math.min(120_000, Math.max(0, Math.round(forced)));
  const low = Math.max(0, Math.min(min, max));
  const high = Math.max(low, Math.min(120_000, Math.max(min, max)));
  return Math.round(low + random() * (high - low));
}

export function schedule(now: number, delayMs: number): { processAfter: number; readyAt: number } {
  const readyAt = now + delayMs;
  if (delayMs <= 0) return { processAfter: now, readyAt };
  const firstHop = Math.min(1000, Math.round(delayMs * 0.34));
  return { processAfter: now + Math.max(1, firstHop), readyAt };
}

export function webhookUrlAllowed(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  if (host === "169.254.169.254" || host.endsWith(".metadata.google.internal")) return false;
  return true;
}
