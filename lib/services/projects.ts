import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { apiKeys, organizations, projects } from "../db/schema";
import { isCnpj, onlyDigits } from "../cnpj";
import { StudyError } from "../errors";
import { parseJson } from "../format";
import { newId } from "../ids";
import { revokeProjectKeys } from "./keys";

export type ProjectInput = {
  name: string;
  cnpj?: string;
  razaoSocial: string;
  inscricaoMunicipal?: string | null;
  inscricaoEstadual?: string | null;
  regimeTributario?: string;
  codigoMunicipio?: string | null;
  email?: string | null;
  telefone?: string | null;
  description?: string | null;
  endereco?: Record<string, string | undefined>;
  codigoTributacao?: string | null;
  tributacaoIss?: number | null;
  serieNfse?: string;
  aliquotaSimples?: number | null;
  regimeIss?: number | null;
  codigoServicoSp?: string | null;
  cnae?: string | null;
  basicAuthUsuario?: string | null;
  basicAuthSenha?: string | null;
  defaultNbs?: string | null;
  defaultCstIbscbs?: string | null;
  defaultClassificacao?: string | null;
  defaultIndicador?: string | null;
  cstPisCofins?: string | null;
  aliquotaPis?: number | null;
  aliquotaCofins?: number | null;
};

function clean(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function mapFields(input: ProjectInput, cnpj?: string) {
  return {
    name: input.name.trim(),
    ...(cnpj ? { cnpj } : {}),
    razaoSocial: input.razaoSocial.trim(),
    inscricaoMunicipal: clean(input.inscricaoMunicipal),
    inscricaoEstadual: clean(input.inscricaoEstadual),
    regimeTributario: input.regimeTributario ?? "3",
    codigoMunicipio: clean(input.codigoMunicipio),
    email: clean(input.email),
    telefone: clean(input.telefone),
    description: clean(input.description),
    enderecoJson: JSON.stringify(input.endereco ?? {}),
    codigoTributacao: clean(input.codigoTributacao),
    tributacaoIss: input.tributacaoIss ?? 1,
    serieNfse: input.serieNfse ?? "1608",
    aliquotaSimples: input.aliquotaSimples ?? null,
    regimeIss: input.regimeIss ?? null,
    codigoServicoSp: clean(input.codigoServicoSp),
    cnae: clean(input.cnae),
    basicAuthUsuario: clean(input.basicAuthUsuario),
    ...(input.basicAuthSenha !== undefined ? { basicAuthSenha: clean(input.basicAuthSenha) } : {}),
    defaultNbs: clean(input.defaultNbs),
    defaultCstIbscbs: clean(input.defaultCstIbscbs),
    defaultClassificacao: clean(input.defaultClassificacao),
    defaultIndicador: clean(input.defaultIndicador),
    cstPisCofins: clean(input.cstPisCofins),
    aliquotaPis: input.aliquotaPis ?? null,
    aliquotaCofins: input.aliquotaCofins ?? null,
  };
}

export function createProject(organizationId: string, input: ProjectInput) {
  const { db } = getDb();
  const org = db.select().from(organizations).where(eq(organizations.id, organizationId)).get();
  if (!org) throw new StudyError(404, "nao_encontrado", "Organização não encontrada.");
  const activeCount = db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.organizationId, organizationId), eq(projects.active, 1)))
    .all().length;
  if (activeCount >= org.projectLimit) {
    throw new StudyError(403, "limite_de_empresas", "O plano de estudo atingiu o limite de CNPJs.");
  }
  const cnpj = onlyDigits(input.cnpj ?? "");
  if (!isCnpj(cnpj)) throw new StudyError(400, "cnpj_invalido", "CNPJ inválido.", "cnpj");
  const duplicate = db
    .select()
    .from(projects)
    .where(and(eq(projects.organizationId, organizationId), eq(projects.cnpj, cnpj), eq(projects.active, 1)))
    .get();
  if (duplicate) {
    throw new StudyError(409, "cnpj_duplicado", "Este CNPJ já está ativo na organização.");
  }
  const now = Date.now();
  const row = {
    id: newId("prj"),
    organizationId,
    ...mapFields(input, cnpj),
    cnpj,
    basicAuthSenha: clean(input.basicAuthSenha),
    ultimoNumeroNfse: 0,
    active: 1,
    certFileName: null,
    certUploadedAt: null,
    logoDataUrl: null,
    createdAt: now,
    updatedAt: now,
  };
  db.insert(projects).values(row).run();
  return row;
}

export function updateProject(id: string, organizationId: string, input: Partial<ProjectInput>) {
  const current = requireProject(id, organizationId);
  const now = Date.now();
  const patch = mapFields(
    {
      name: input.name ?? current.name,
      razaoSocial: input.razaoSocial ?? current.razaoSocial,
      regimeTributario: input.regimeTributario ?? current.regimeTributario,
      serieNfse: input.serieNfse ?? current.serieNfse,
      tributacaoIss: input.tributacaoIss === undefined ? current.tributacaoIss : input.tributacaoIss,
      aliquotaSimples: input.aliquotaSimples === undefined ? current.aliquotaSimples : input.aliquotaSimples,
      regimeIss: input.regimeIss === undefined ? current.regimeIss : input.regimeIss,
      aliquotaPis: input.aliquotaPis === undefined ? current.aliquotaPis : input.aliquotaPis,
      aliquotaCofins: input.aliquotaCofins === undefined ? current.aliquotaCofins : input.aliquotaCofins,
      inscricaoMunicipal: input.inscricaoMunicipal === undefined ? current.inscricaoMunicipal : input.inscricaoMunicipal,
      inscricaoEstadual: input.inscricaoEstadual === undefined ? current.inscricaoEstadual : input.inscricaoEstadual,
      codigoMunicipio: input.codigoMunicipio === undefined ? current.codigoMunicipio : input.codigoMunicipio,
      email: input.email === undefined ? current.email : input.email,
      telefone: input.telefone === undefined ? current.telefone : input.telefone,
      description: input.description === undefined ? current.description : input.description,
      endereco: input.endereco ?? parseJson(current.enderecoJson, {}),
      codigoTributacao: input.codigoTributacao === undefined ? current.codigoTributacao : input.codigoTributacao,
      codigoServicoSp: input.codigoServicoSp === undefined ? current.codigoServicoSp : input.codigoServicoSp,
      cnae: input.cnae === undefined ? current.cnae : input.cnae,
      basicAuthUsuario: input.basicAuthUsuario === undefined ? current.basicAuthUsuario : input.basicAuthUsuario,
      defaultNbs: input.defaultNbs === undefined ? current.defaultNbs : input.defaultNbs,
      defaultCstIbscbs: input.defaultCstIbscbs === undefined ? current.defaultCstIbscbs : input.defaultCstIbscbs,
      defaultClassificacao: input.defaultClassificacao === undefined ? current.defaultClassificacao : input.defaultClassificacao,
      defaultIndicador: input.defaultIndicador === undefined ? current.defaultIndicador : input.defaultIndicador,
      cstPisCofins: input.cstPisCofins === undefined ? current.cstPisCofins : input.cstPisCofins,
    },
  );
  if (input.basicAuthSenha !== undefined) {
    Object.assign(patch, { basicAuthSenha: clean(input.basicAuthSenha) });
  }
  getDb()
    .db.update(projects)
    .set({ ...patch, updatedAt: now })
    .where(eq(projects.id, id))
    .run();
  return requireProject(id, organizationId);
}

export function deactivateProject(id: string, organizationId: string): void {
  requireProject(id, organizationId);
  const result = getDb()
    .db.update(projects)
    .set({ active: 0, updatedAt: Date.now() })
    .where(and(eq(projects.id, id), eq(projects.organizationId, organizationId), eq(projects.active, 1)))
    .run();
  if (result.changes === 0) throw new StudyError(404, "nao_encontrado", "Empresa não encontrada ou já inativa.");
  revokeProjectKeys(id);
}

export function listProjects(organizationId: string, includeInactive = false) {
  const where = includeInactive
    ? eq(projects.organizationId, organizationId)
    : and(eq(projects.organizationId, organizationId), eq(projects.active, 1));
  return getDb().db.select().from(projects).where(where).orderBy(desc(projects.createdAt)).all();
}

export function requireProject(id: string, organizationId: string) {
  const project = getDb()
    .db.select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.organizationId, organizationId)))
    .get();
  if (!project) throw new StudyError(404, "nao_encontrado", "Empresa não encontrada.");
  return project;
}

export function hasApiKey(projectId: string): boolean {
  const row = getDb()
    .db.select({ id: apiKeys.id })
    .from(apiKeys)
    .where(and(eq(apiKeys.projectId, projectId), eq(apiKeys.active, 1)))
    .get();
  return Boolean(row);
}

export function setNumeracao(id: string, organizationId: string, ultimoNumeroNfse: number) {
  const project = requireProject(id, organizationId);
  if (!Number.isInteger(ultimoNumeroNfse) || ultimoNumeroNfse < 0) {
    throw new StudyError(400, "numero_invalido", "O último número precisa ser um inteiro positivo.", "ultimoNumeroNfse");
  }
  getDb()
    .sqlite.prepare("UPDATE projects SET ultimo_numero_nfse = MAX(ultimo_numero_nfse, ?), updated_at = ? WHERE id = ?")
    .run(ultimoNumeroNfse, Date.now(), id);
  const next = requireProject(id, organizationId);
  return {
    nfse: {
      ultimoNumero: next.ultimoNumeroNfse,
      proximoNumero: next.ultimoNumeroNfse + 1,
      serie: next.serieNfse,
    },
    ignorado: ultimoNumeroNfse < project.ultimoNumeroNfse ? ["ultimoNumeroNfse"] : [],
  };
}

export function saveCertificate(id: string, organizationId: string, fileName: string) {
  requireProject(id, organizationId);
  if (!fileName || fileName.length > 120) throw new StudyError(400, "arquivo_invalido", "Envie um arquivo de certificado.");
  const now = Date.now();
  getDb()
    .db.update(projects)
    .set({ certFileName: fileName, certUploadedAt: now, updatedAt: now })
    .where(eq(projects.id, id))
    .run();
  return {
    fileName,
    validado: false,
    aviso: "Metadado de estudo. O arquivo não foi aberto, a senha foi descartada e nenhuma assinatura será feita.",
    uploadedAt: new Date(now).toISOString(),
  };
}

export function saveLogo(id: string, organizationId: string, dataUrl: string) {
  requireProject(id, organizationId);
  if (!/^data:image\/(png|jpeg|webp);base64,/.test(dataUrl)) {
    throw new StudyError(400, "logo_invalida", "Envie PNG, JPEG ou WebP.", "file");
  }
  if (dataUrl.length > 700_000) throw new StudyError(413, "logo_grande", "A logo passa de 500 KB.");
  getDb().db.update(projects).set({ logoDataUrl: dataUrl, updatedAt: Date.now() }).where(eq(projects.id, id)).run();
  return { ok: true, aviso: "Logo armazenada só para o PDF de estudo." };
}

export function removeLogo(id: string, organizationId: string) {
  requireProject(id, organizationId);
  getDb().db.update(projects).set({ logoDataUrl: null, updatedAt: Date.now() }).where(eq(projects.id, id)).run();
  return { ok: true };
}

export function publicProject(row: typeof projects.$inferSelect, withKey = false) {
  return {
    id: row.id,
    name: row.name,
    cnpj: row.cnpj,
    razaoSocial: row.razaoSocial,
    inscricaoMunicipal: row.inscricaoMunicipal,
    inscricaoEstadual: row.inscricaoEstadual,
    regimeTributario: row.regimeTributario,
    codigoMunicipio: row.codigoMunicipio,
    email: row.email,
    telefone: row.telefone,
    description: row.description,
    endereco: parseJson(row.enderecoJson, {}),
    codigoTributacao: row.codigoTributacao,
    tributacaoIss: row.tributacaoIss,
    serieNfse: row.serieNfse,
    aliquotaSimples: row.aliquotaSimples,
    regimeIss: row.regimeIss,
    codigoServicoSp: row.codigoServicoSp,
    cnae: row.cnae,
    basicAuthUsuario: row.basicAuthUsuario,
    hasBasicAuthSenha: Boolean(row.basicAuthSenha),
    ultimoNumeroNfse: row.ultimoNumeroNfse,
    proximoNumeroNfse: row.ultimoNumeroNfse + 1,
    defaultNbs: row.defaultNbs,
    defaultCstIbscbs: row.defaultCstIbscbs,
    defaultClassificacao: row.defaultClassificacao,
    defaultIndicador: row.defaultIndicador,
    cstPisCofins: row.cstPisCofins,
    aliquotaPis: row.aliquotaPis,
    aliquotaCofins: row.aliquotaCofins,
    active: row.active === 1,
    hasCertificate: Boolean(row.certFileName),
    certFileName: row.certFileName,
    certUploadedAt: row.certUploadedAt ? new Date(row.certUploadedAt).toISOString() : null,
    hasLogo: Boolean(row.logoDataUrl),
    hasApiKey: withKey ? hasApiKey(row.id) : undefined,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

export function numeracaoOf(row: typeof projects.$inferSelect) {
  return {
    nfse: {
      ultimoNumero: row.ultimoNumeroNfse,
      proximoNumero: row.ultimoNumeroNfse + 1,
      serie: row.serieNfse,
    },
  };
}
