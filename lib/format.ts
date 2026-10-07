export function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function formatWhen(ms: number | null | undefined): string {
  if (!ms) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(ms));
}

export function competenciaAtual(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).format(now);
  return parts.slice(0, 7);
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export const STATUS_LABEL: Record<string, string> = {
  queued: "Na fila",
  processing: "Processando",
  issued: "Emitida",
  error: "Erro",
  cancel_queued: "Cancelamento na fila",
  cancelled: "Cancelada",
};

export const REGIME_LABEL: Record<string, string> = {
  "1": "Não optante",
  "2": "MEI",
  "3": "Simples Nacional ME/EPP",
  "3e": "Simples — excesso de sublimite",
};

export const RESULT_LABEL: Record<string, string> = {
  sucesso: "Sucesso",
  rejeicao: "Rejeição municipal",
  timeout: "Timeout",
  indisponivel: "Serviço indisponível",
};
