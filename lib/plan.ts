export const STUDY_PLAN = {
  name: "Estudo",
  creditsLimit: 50,
  projectLimit: 5,
  projectRateLimit: 60,
  orgRateLimit: 120,
};

export const NFSE_EVENTS = [
  "nfse.issued",
  "nfse.error",
  "nfse.cancelled",
  "nfse.documents_ready",
] as const;

export type NfseEvent = (typeof NFSE_EVENTS)[number];

export const DEFAULT_RETRIES = [10_000, 30_000, 60_000];

export const SIM_RESULTS = ["sucesso", "rejeicao", "timeout", "indisponivel"] as const;
export type SimResult = (typeof SIM_RESULTS)[number];

export const FAILURES: Record<Exclude<SimResult, "sucesso">, { code: string; message: string }> = {
  rejeicao: {
    code: "E001",
    message: "Rejeição municipal simulada: o código de serviço não foi aceito pela prefeitura de estudo.",
  },
  timeout: {
    code: "E002",
    message: "Timeout simulado: a prefeitura não respondeu dentro do prazo da bancada.",
  },
  indisponivel: {
    code: "E003",
    message: "Indisponibilidade simulada: o autorizador municipal de estudo está fora do ar.",
  },
};

export const QUOTA_ERROR = {
  code: "E004",
  message: "Cota do plano de estudo esgotada antes da autorização simulada.",
};

export const CANCEL_FAILURES: Record<Exclude<SimResult, "sucesso">, string> = {
  rejeicao: "Rejeição simulada do cancelamento: a prefeitura de estudo recusou o pedido.",
  timeout: "Timeout simulado no cancelamento: a prefeitura não respondeu.",
  indisponivel: "Indisponibilidade simulada: o cancelamento não foi recebido pela prefeitura de estudo.",
};

export const STUDY_AVISO =
  "Ambiente de estudo. Nenhum documento foi transmitido à SEFAZ ou a uma prefeitura. Sem valor fiscal.";
