"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "../auth/session";
import { StudyError } from "../errors";
import { roundMoney } from "../format";
import { createApiKey, revokeKey } from "../services/keys";
import { createInvoice, requestCancel } from "../services/invoices";
import { writeLog } from "../services/logs";
import {
  createProject,
  deactivateProject,
  requireProject,
  saveCertificate,
  saveLogo,
  setNumeracao,
  updateProject,
} from "../services/projects";
import { sampleRolls, simulateVerification, updateSimulation, updateStorage } from "../services/settings";
import { createEndpoint, deleteEndpoint, enqueueTest } from "../services/webhooks";
import { blankToNull, numberOrNull, validateEmit } from "../validation";
import { actionError, type ActionState } from "./types";
import type { SimResult } from "../plan";
import { NFSE_EVENTS } from "../plan";

async function sessionOrError(): Promise<ActionState | Awaited<ReturnType<typeof getSession>>> {
  const session = await getSession();
  if (!session) return { error: "Sessão expirada. Entre de novo." };
  return session;
}

function isState(value: unknown): value is ActionState {
  return value == null || (typeof value === "object" && "error" in (value as object));
}

export async function saveEmpresaAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await sessionOrError();
  if (isState(session)) return session;
  const id = blankToNull(formData.get("id"));
  const input = {
    name: String(formData.get("name") ?? ""),
    cnpj: String(formData.get("cnpj") ?? ""),
    razaoSocial: String(formData.get("razaoSocial") ?? ""),
    inscricaoMunicipal: blankToNull(formData.get("inscricaoMunicipal")),
    inscricaoEstadual: blankToNull(formData.get("inscricaoEstadual")),
    regimeTributario: String(formData.get("regimeTributario") ?? "3"),
    codigoMunicipio: blankToNull(formData.get("codigoMunicipio")),
    email: blankToNull(formData.get("email")),
    telefone: blankToNull(formData.get("telefone")),
    description: blankToNull(formData.get("description")),
    endereco: {
      logradouro: blankToNull(formData.get("logradouro")) ?? undefined,
      numero: blankToNull(formData.get("numero")) ?? undefined,
      complemento: blankToNull(formData.get("complemento")) ?? undefined,
      bairro: blankToNull(formData.get("bairro")) ?? undefined,
      cidade: blankToNull(formData.get("cidade")) ?? undefined,
      uf: blankToNull(formData.get("uf")) ?? undefined,
      cep: blankToNull(formData.get("cep")) ?? undefined,
    },
    codigoTributacao: blankToNull(formData.get("codigoTributacao")),
    tributacaoIss: numberOrNull(formData.get("tributacaoIss")),
    serieNfse: blankToNull(formData.get("serieNfse")) ?? "1608",
    aliquotaSimples: numberOrNull(formData.get("aliquotaSimples")),
    cnae: blankToNull(formData.get("cnae")),
    codigoServicoSp: blankToNull(formData.get("codigoServicoSp")),
    basicAuthUsuario: blankToNull(formData.get("basicAuthUsuario")),
    basicAuthSenha: blankToNull(formData.get("basicAuthSenha")) ?? undefined,
    defaultNbs: blankToNull(formData.get("defaultNbs")),
    defaultCstIbscbs: blankToNull(formData.get("defaultCstIbscbs")),
    defaultClassificacao: blankToNull(formData.get("defaultClassificacao")),
    cstPisCofins: blankToNull(formData.get("cstPisCofins")),
    aliquotaPis: numberOrNull(formData.get("aliquotaPis")),
    aliquotaCofins: numberOrNull(formData.get("aliquotaCofins")),
  };
  try {
    const saved = id
      ? updateProject(id, session.org.id, input)
      : createProject(session.org.id, input);
    revalidatePath("/painel/empresas");
    redirect(id ? `/painel/empresas/${saved.id}` : `/painel/empresas/${saved.id}`);
  } catch (error) {
    if (isRedirect(error)) throw error;
    return actionError(error);
  }
}

export async function deactivateEmpresaAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  deactivateProject(String(formData.get("id")), session.org.id);
  revalidatePath("/painel/empresas");
  redirect("/painel/empresas");
}

export async function numeracaoAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await sessionOrError();
  if (isState(session)) return session;
  try {
    const result = setNumeracao(String(formData.get("id")), session.org.id, Number(formData.get("ultimoNumeroNfse")));
    revalidatePath(`/painel/empresas/${String(formData.get("id"))}`);
    return { ok: result.ignorado.length ? "Número menor foi ignorado. A sequência não volta atrás." : "Numeração atualizada." };
  } catch (error) {
    return actionError(error);
  }
}

export async function certificateAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await sessionOrError();
  if (isState(session)) return session;
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Escolha o arquivo do certificado." };
  if (typeof formData.get("password") !== "string" || String(formData.get("password")).length === 0) {
    return { error: "Informe a senha. Ela será descartada." };
  }
  try {
    const saved = saveCertificate(String(formData.get("id")), session.org.id, file.name);
    revalidatePath(`/painel/empresas/${String(formData.get("id"))}`);
    return { ok: saved.aviso };
  } catch (error) {
    return actionError(error);
  }
}

export async function logoAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await sessionOrError();
  if (isState(session)) return session;
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Escolha uma imagem PNG, JPEG ou WebP." };
  const bytes = Buffer.from(await file.arrayBuffer());
  const type = file.type === "image/jpg" ? "image/jpeg" : file.type;
  try {
    const saved = saveLogo(String(formData.get("id")), session.org.id, `data:${type};base64,${bytes.toString("base64")}`);
    revalidatePath(`/painel/empresas/${String(formData.get("id"))}`);
    return { ok: saved.aviso };
  } catch (error) {
    return actionError(error);
  }
}

export async function emitNoteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await sessionOrError();
  if (isState(session)) return session;
  const started = Date.now();
  const projectId = String(formData.get("projectId") ?? "");
  try {
    const project = requireProject(projectId, session.org.id);
    const resultado = blankToNull(formData.get("resultado"));
    const atraso = numberOrNull(formData.get("atrasoMs"));
    const exportPais = blankToNull(formData.get("paisResultado"));
    const deducaoModo = blankToNull(formData.get("deducaoModo"));
    const deducaoValor = numberOrNull(formData.get("deducaoValor"));
    const eventoNome = blankToNull(formData.get("eventoNome"));
    const obraCodigo = blankToNull(formData.get("codigoObra"));
    const body = {
      tomador: {
        nome: String(formData.get("tomadorNome") ?? ""),
        cnpj: blankToNull(formData.get("tomadorCnpj")) ?? undefined,
        cpf: blankToNull(formData.get("tomadorCpf")) ?? undefined,
        email: blankToNull(formData.get("tomadorEmail")) ?? undefined,
        telefone: blankToNull(formData.get("tomadorTelefone")) ?? undefined,
        endereco: {
          logradouro: blankToNull(formData.get("logradouro")) ?? undefined,
          numero: blankToNull(formData.get("numero")) ?? undefined,
          bairro: blankToNull(formData.get("bairro")) ?? undefined,
          cidade: blankToNull(formData.get("cidade")) ?? undefined,
          uf: blankToNull(formData.get("uf")) ?? undefined,
          cep: blankToNull(formData.get("cep")) ?? undefined,
        },
      },
      servico: {
        descricao: String(formData.get("descricao") ?? ""),
        codigo: blankToNull(formData.get("codigo")) ?? undefined,
        informacoesComplementares: blankToNull(formData.get("informacoesComplementares")) ?? undefined,
        ...(obraCodigo ? { obra: { codigoObra: obraCodigo, art: blankToNull(formData.get("art")) } } : {}),
        ...(eventoNome
          ? {
              evento: {
                nome: eventoNome,
                dataInicio: blankToNull(formData.get("dataInicio")),
                dataFim: blankToNull(formData.get("dataFim")),
              },
            }
          : {}),
      },
      valores: {
        total: roundMoney(Number(formData.get("total"))),
        aliquotaIss: Number(formData.get("aliquotaIss")),
        issRetido: formData.get("issRetido") === "on",
        ...(exportPais
          ? {
              exportacao: {
                paisResultado: exportPais,
                modoPrestacao: numberOrNull(formData.get("modoPrestacao")) ?? undefined,
                codigoMoeda: blankToNull(formData.get("codigoMoeda")) ?? undefined,
                valorServicoMoeda: numberOrNull(formData.get("valorServicoMoeda")) ?? undefined,
              },
            }
          : {}),
        ...(deducaoModo === "percentual" && deducaoValor != null ? { deducoes: { percentual: deducaoValor } } : {}),
        ...(deducaoModo === "valor" && deducaoValor != null ? { deducoes: { valor: deducaoValor } } : {}),
        retencaoIrrf: numberOrNull(formData.get("retencaoIrrf")) ?? undefined,
        retencaoCp: numberOrNull(formData.get("retencaoCp")) ?? undefined,
        retencaoCsll: numberOrNull(formData.get("retencaoCsll")) ?? undefined,
        ...(blankToNull(formData.get("cstIbscbs"))
          ? {
              ibscbs: {
                cst: blankToNull(formData.get("cstIbscbs")),
                classificacaoTributaria: blankToNull(formData.get("classificacao")),
                nbs: blankToNull(formData.get("nbs")),
              },
            }
          : {}),
      },
      competencia: blankToNull(formData.get("competencia")) ?? undefined,
      referencia: blankToNull(formData.get("referencia")) ?? undefined,
      simulacao: {
        ...(resultado ? { resultado: resultado as SimResult } : {}),
        ...(atraso != null ? { atrasoMs: atraso } : {}),
      },
    };
    const validated = validateEmit(body);
    if ("error" in validated) throw new StudyError(400, "payload_invalido", validated.error, validated.campo);
    const created = createInvoice({
      org: session.org,
      project,
      emit: validated.data,
      sim: validated.sim,
    });
    writeLog({
      organizationId: session.org.id,
      projectId: project.id,
      method: "PANEL",
      path: "/painel/notas/nova",
      statusCode: 202,
      durationMs: Date.now() - started,
    });
    revalidatePath("/painel/notas");
    redirect(`/painel/notas/${created.invoice.id}`);
  } catch (error) {
    if (isRedirect(error)) throw error;
    writeLog({
      organizationId: session.org.id,
      projectId,
      method: "PANEL",
      path: "/painel/notas/nova",
      statusCode: error instanceof StudyError ? error.status : 500,
      durationMs: Date.now() - started,
    });
    return actionError(error);
  }
}

export async function cancelNoteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await sessionOrError();
  if (isState(session)) return session;
  try {
    const project = requireProject(String(formData.get("projectId")), session.org.id);
    const resultado = blankToNull(formData.get("resultado"));
    const atraso = numberOrNull(formData.get("atrasoMs"));
    requestCancel({
      org: session.org,
      project,
      invoiceId: String(formData.get("invoiceId")),
      motivo: blankToNull(formData.get("motivo")) ?? undefined,
      codigoMotivo: numberOrNull(formData.get("codigoMotivo")) ?? undefined,
      sim: {
        ...(resultado ? { resultado: resultado as SimResult } : {}),
        ...(atraso != null ? { atrasoMs: atraso } : {}),
      },
    });
    revalidatePath(`/painel/notas/${String(formData.get("invoiceId"))}`);
    return { ok: "Cancelamento entrou na fila simulada." };
  } catch (error) {
    return actionError(error);
  }
}

export async function createKeyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await sessionOrError();
  if (isState(session)) return session;
  try {
    const kind = String(formData.get("kind")) === "org" ? "org" : "project";
    const projectId = blankToNull(formData.get("projectId"));
    if (kind === "project" && projectId) requireProject(projectId, session.org.id);
    const created = createApiKey({
      organizationId: session.org.id,
      projectId,
      kind,
      name: String(formData.get("name") ?? ""),
      rateLimitPerMinute: numberOrNull(formData.get("rateLimitPerMinute")) ?? undefined,
    });
    revalidatePath("/painel/chaves");
    return { ok: "Guarde a chave agora. Ela não será mostrada de novo.", key: created.key };
  } catch (error) {
    return actionError(error);
  }
}

export async function revokeKeyAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  revokeKey(String(formData.get("id")), session.org.id);
  revalidatePath("/painel/chaves");
}

export async function createWebhookAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await sessionOrError();
  if (isState(session)) return session;
  try {
    const project = requireProject(String(formData.get("projectId")), session.org.id);
    const events = NFSE_EVENTS.filter((event) => formData.get(event) === "on");
    const created = createEndpoint({
      organizationId: session.org.id,
      projectId: project.id,
      url: String(formData.get("url") ?? ""),
      events: events.length ? [...events] : ["nfse.issued", "nfse.error"],
      secret: blankToNull(formData.get("secret")),
    });
    revalidatePath("/painel/webhooks");
    return { ok: "Webhook cadastrado.", secret: created.secret ?? undefined };
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteWebhookAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  deleteEndpoint(String(formData.get("id")), String(formData.get("projectId")));
  revalidatePath("/painel/webhooks");
}

export async function testWebhookAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await sessionOrError();
  if (isState(session)) return session;
  try {
    requireProject(String(formData.get("projectId")), session.org.id);
    enqueueTest(String(formData.get("id")), String(formData.get("projectId")));
    return { ok: "Evento de teste entrou na fila. O varredor envia em instantes." };
  } catch (error) {
    return actionError(error);
  }
}

export async function simulationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await sessionOrError();
  if (isState(session)) return session;
  try {
    updateSimulation(session.org.id, {
      latencyMinMs: Number(formData.get("latencyMinMs")),
      latencyMaxMs: Number(formData.get("latencyMaxMs")),
      failureRate: Number(formData.get("failureRate")),
      retries: [Number(formData.get("retry1")), Number(formData.get("retry2")), Number(formData.get("retry3"))],
    });
    revalidatePath("/painel/simulacao");
    return { ok: "Cenário da organização atualizado." };
  } catch (error) {
    return actionError(error);
  }
}

export async function sampleAction(_prev: ActionState, _formData: FormData): Promise<ActionState> {
  const session = await sessionOrError();
  if (isState(session)) return session;
  try {
    return { rolls: sampleRolls(session.org.id, 10) };
  } catch (error) {
    return actionError(error);
  }
}

export async function storageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await sessionOrError();
  if (isState(session)) return session;
  try {
    if (formData.get("verificar") === "1") {
      const result = simulateVerification(session.org.id);
      revalidatePath("/painel/uso");
      return { ok: result.message };
    }
    const url = blankToNull(formData.get("storageBaseUrl"));
    const result = updateStorage(session.org.id, url);
    revalidatePath("/painel/uso");
    return { ok: result.message };
  } catch (error) {
    return actionError(error);
  }
}

function isRedirect(error: unknown): boolean {
  return typeof error === "object" && error !== null && "digest" in error && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT");
}
