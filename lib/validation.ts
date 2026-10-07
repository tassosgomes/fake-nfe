import { z } from "zod";
import { isCnpj, isCpf, onlyDigits } from "./cnpj";
import { NFSE_EVENTS, SIM_RESULTS } from "./plan";
import { parseSimObject, type SimOverride } from "./simulation/decide";

const enderecoSchema = z
  .object({
    logradouro: z.string().max(120).optional(),
    numero: z.string().max(20).optional(),
    complemento: z.string().max(80).optional(),
    bairro: z.string().max(80).optional(),
    cidade: z.string().max(80).optional(),
    uf: z.string().max(2).optional(),
    cep: z.string().max(12).optional(),
    pais: z.string().max(2).optional(),
  })
  .partial();

export const emitSchema = z.object({
  tomador: z
    .object({
      nome: z.string().trim().min(2).max(300),
      cnpj: z.string().optional(),
      cpf: z.string().optional(),
      nif: z.string().max(40).optional(),
      email: z.string().email().max(160).optional().or(z.literal("")),
      telefone: z.string().max(20).optional(),
      endereco: enderecoSchema.optional(),
    })
    .passthrough(),
  servico: z
    .object({
      descricao: z.string().trim().min(1).max(2000),
      codigo: z.string().max(20).optional(),
    })
    .passthrough(),
  valores: z
    .object({
      total: z.number().positive().max(999_999_999),
      aliquotaIss: z.number().min(0).max(100),
      issRetido: z.boolean().optional(),
    })
    .passthrough(),
  competencia: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  referencia: z.string().max(80).optional(),
  simulacao: z
    .object({
      resultado: z.enum(SIM_RESULTS).optional(),
      atrasoMs: z.number().int().min(0).max(120_000).optional(),
    })
    .optional(),
});

export type EmitInput = z.infer<typeof emitSchema>;

export function validateEmit(body: unknown): { data: EmitInput; sim: SimOverride } | { error: string; campo?: string } {
  const parsed = emitSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue?.message ?? "Payload inválido", campo: issue?.path.join(".") };
  }
  const tomador = parsed.data.tomador;
  const cnpj = tomador.cnpj ? onlyDigits(String(tomador.cnpj)) : "";
  const cpf = tomador.cpf ? onlyDigits(String(tomador.cpf)) : "";
  const nif = tomador.nif?.trim() ?? "";
  if (!cnpj && !cpf && !nif) {
    return { error: "Informe CNPJ, CPF ou NIF do tomador", campo: "tomador.cnpj" };
  }
  if (cnpj && !isCnpj(cnpj)) return { error: "CNPJ do tomador inválido", campo: "tomador.cnpj" };
  if (cpf && !isCpf(cpf)) return { error: "CPF do tomador inválido", campo: "tomador.cpf" };
  if (tomador.email === "") delete tomador.email;
  const simParsed = parseSimObject(parsed.data.simulacao ?? {});
  if ("error" in simParsed) return { error: simParsed.error, campo: "simulacao" };
  return { data: parsed.data, sim: simParsed };
}

const regime = z.enum(["1", "2", "3", "3e"]);

export const projectSchema = z.object({
  name: z.string().trim().min(2).max(80),
  cnpj: z.string().refine((value) => isCnpj(value), "CNPJ inválido"),
  razaoSocial: z.string().trim().min(2).max(200),
  inscricaoMunicipal: z.string().max(20).optional().nullable(),
  inscricaoEstadual: z.string().max(20).optional().nullable(),
  regimeTributario: regime.optional(),
  codigoMunicipio: z.union([z.string().regex(/^\d{7}$/), z.literal(""), z.null()]).optional(),
  email: z.union([z.string().email(), z.literal(""), z.null()]).optional(),
  telefone: z.string().max(20).optional().nullable(),
  description: z.string().max(300).optional().nullable(),
  endereco: enderecoSchema.optional(),
  codigoTributacao: z.string().max(20).optional().nullable(),
  tributacaoIss: z.number().int().min(1).max(4).optional().nullable(),
  serieNfse: z.string().regex(/^\d{1,5}$/).optional(),
  aliquotaSimples: z.number().min(0).max(100).optional().nullable(),
  regimeIss: z.number().int().min(1).max(3).optional().nullable(),
  codigoServicoSp: z.string().max(10).optional().nullable(),
  cnae: z.string().max(10).optional().nullable(),
  basicAuthUsuario: z.string().max(80).optional().nullable(),
  basicAuthSenha: z.string().max(80).optional().nullable(),
  defaultNbs: z.string().max(12).optional().nullable(),
  defaultCstIbscbs: z.string().max(3).optional().nullable(),
  defaultClassificacao: z.string().max(6).optional().nullable(),
  defaultIndicador: z.string().max(6).optional().nullable(),
  cstPisCofins: z.string().max(2).optional().nullable(),
  aliquotaPis: z.number().min(0).max(100).optional().nullable(),
  aliquotaCofins: z.number().min(0).max(100).optional().nullable(),
});

export const projectPatchSchema = projectSchema.partial().omit({ cnpj: true });

export const webhookSchema = z.object({
  url: z.string().url().max(300),
  events: z.array(z.enum(NFSE_EVENTS)).min(1),
  secret: z.string().max(120).nullable().optional(),
  active: z.boolean().optional(),
  projectId: z.string().optional(),
});

export function blankToNull(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function numberOrNull(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
