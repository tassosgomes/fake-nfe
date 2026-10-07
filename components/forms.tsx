"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { loginAction, registerAction } from "@/lib/actions/auth";
import {
  cancelNoteAction,
  certificateAction,
  createKeyAction,
  createWebhookAction,
  emitNoteAction,
  logoAction,
  numeracaoAction,
  sampleAction,
  saveEmpresaAction,
  simulationAction,
  storageAction,
  testWebhookAction,
} from "@/lib/actions/panel";
import type { ActionState } from "@/lib/actions/types";
import { NFSE_EVENTS } from "@/lib/plan";

function PendingButton({ children }: { children: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="primary" disabled={pending}>
      {pending ? "Aguarde…" : children}
    </button>
  );
}

function Feedback({ state }: { state: ActionState }) {
  if (!state?.error && !state?.ok && !state?.key) return null;
  return (
    <div className="stack">
      {state?.error ? <p className="form-error">{state.error}</p> : null}
      {state?.ok ? <p className="banner-ok">{state.ok}</p> : null}
      {state?.key ? <code className="keybox">{state.key}</code> : null}
      {state?.secret ? <p className="muted">Segredo gravado. Ele assina o corpo com HMAC-SHA256.</p> : null}
    </div>
  );
}

export function LoginForm() {
  const [state, action] = useActionState(loginAction, null);
  return (
    <form action={action} className="stack">
      <Feedback state={state} />
      <label>E-mail<input name="email" type="email" required autoComplete="username" /></label>
      <label>Senha<input name="password" type="password" required autoComplete="current-password" /></label>
      <PendingButton>Entrar</PendingButton>
    </form>
  );
}

export function RegisterForm() {
  const [state, action] = useActionState(registerAction, null);
  return (
    <form action={action} className="stack">
      <Feedback state={state} />
      <label>Seu nome<input name="name" required minLength={2} /></label>
      <label>E-mail<input name="email" type="email" required /></label>
      <label>Senha<input name="password" type="password" required minLength={8} /></label>
      <label>Nome da organização<input name="organization" required minLength={2} /></label>
      <PendingButton>Criar bancada</PendingButton>
    </form>
  );
}

type EmpresaDefaults = {
  id?: string;
  name?: string;
  cnpj?: string;
  razaoSocial?: string;
  inscricaoMunicipal?: string | null;
  inscricaoEstadual?: string | null;
  regimeTributario?: string;
  codigoMunicipio?: string | null;
  email?: string | null;
  telefone?: string | null;
  description?: string | null;
  endereco?: { logradouro?: string; numero?: string; bairro?: string; cidade?: string; uf?: string; cep?: string; complemento?: string };
  serieNfse?: string;
  cnae?: string | null;
  codigoServicoSp?: string | null;
  codigoTributacao?: string | null;
  aliquotaSimples?: number | null;
  basicAuthUsuario?: string | null;
  defaultNbs?: string | null;
  defaultCstIbscbs?: string | null;
  defaultClassificacao?: string | null;
  cstPisCofins?: string | null;
  aliquotaPis?: number | null;
  aliquotaCofins?: number | null;
  tributacaoIss?: number | null;
};

export function EmpresaForm({ defaults }: { defaults?: EmpresaDefaults }) {
  const [state, action] = useActionState(saveEmpresaAction, null);
  const address = defaults?.endereco ?? {};
  return (
    <form action={action} className="stack">
      <Feedback state={state} />
      {defaults?.id ? <input type="hidden" name="id" value={defaults.id} /> : null}
      <div className="grid-2">
        <label>Nome interno<input name="name" required defaultValue={defaults?.name ?? ""} /></label>
        <label>CNPJ<input name="cnpj" required defaultValue={defaults?.cnpj ?? ""} readOnly={Boolean(defaults?.id)} /></label>
        <label>Razão social<input name="razaoSocial" required defaultValue={defaults?.razaoSocial ?? ""} /></label>
        <label>Regime
          <select name="regimeTributario" defaultValue={defaults?.regimeTributario ?? "3"}>
            <option value="1">Não optante</option>
            <option value="2">MEI</option>
            <option value="3">Simples Nacional</option>
            <option value="3e">Simples — excesso</option>
          </select>
        </label>
        <label>Inscrição municipal<input name="inscricaoMunicipal" defaultValue={defaults?.inscricaoMunicipal ?? ""} /></label>
        <label>Inscrição estadual<input name="inscricaoEstadual" defaultValue={defaults?.inscricaoEstadual ?? ""} /></label>
        <label>Código IBGE<input name="codigoMunicipio" defaultValue={defaults?.codigoMunicipio ?? ""} placeholder="3550308" /></label>
        <label>CNAE<input name="cnae" defaultValue={defaults?.cnae ?? ""} /></label>
        <label>E-mail<input name="email" type="email" defaultValue={defaults?.email ?? ""} /></label>
        <label>Telefone<input name="telefone" defaultValue={defaults?.telefone ?? ""} /></label>
      </div>
      <label>Descrição<textarea name="description" defaultValue={defaults?.description ?? ""} /></label>
      <fieldset>
        <legend>Endereço</legend>
        <div className="grid-2">
          <label>Logradouro<input name="logradouro" defaultValue={address.logradouro ?? ""} /></label>
          <label>Número<input name="numero" defaultValue={address.numero ?? ""} /></label>
          <label>Bairro<input name="bairro" defaultValue={address.bairro ?? ""} /></label>
          <label>Cidade<input name="cidade" defaultValue={address.cidade ?? ""} /></label>
          <label>UF<input name="uf" defaultValue={address.uf ?? ""} maxLength={2} /></label>
          <label>CEP<input name="cep" defaultValue={address.cep ?? ""} /></label>
        </div>
      </fieldset>
      <fieldset>
        <legend>NFS-e de estudo</legend>
        <div className="grid-2">
          <label>Série<input name="serieNfse" defaultValue={defaults?.serieNfse ?? "1608"} /></label>
          <label>Código de serviço SP<input name="codigoServicoSp" defaultValue={defaults?.codigoServicoSp ?? ""} /></label>
          <label>Código de tributação<input name="codigoTributacao" defaultValue={defaults?.codigoTributacao ?? ""} /></label>
          <label>Tributação ISS (1 a 4)<input name="tributacaoIss" type="number" defaultValue={defaults?.tributacaoIss ?? 1} /></label>
          <label>Alíquota Simples<input name="aliquotaSimples" type="number" step="0.01" defaultValue={defaults?.aliquotaSimples ?? ""} /></label>
          <label>NBS padrão<input name="defaultNbs" defaultValue={defaults?.defaultNbs ?? ""} /></label>
          <label>CST IBS/CBS<input name="defaultCstIbscbs" defaultValue={defaults?.defaultCstIbscbs ?? ""} /></label>
          <label>Classificação<input name="defaultClassificacao" defaultValue={defaults?.defaultClassificacao ?? ""} /></label>
          <label>CST PIS/COFINS<input name="cstPisCofins" defaultValue={defaults?.cstPisCofins ?? ""} /></label>
          <label>Alíquota PIS<input name="aliquotaPis" type="number" step="0.01" defaultValue={defaults?.aliquotaPis ?? ""} /></label>
          <label>Alíquota COFINS<input name="aliquotaCofins" type="number" step="0.01" defaultValue={defaults?.aliquotaCofins ?? ""} /></label>
          <label>Usuário municipal<input name="basicAuthUsuario" defaultValue={defaults?.basicAuthUsuario ?? ""} /></label>
          <label>Senha municipal<input name="basicAuthSenha" type="password" placeholder={defaults?.id ? "em branco mantém a atual" : ""} /></label>
        </div>
      </fieldset>
      <PendingButton>{defaults?.id ? "Salvar empresa" : "Cadastrar empresa"}</PendingButton>
    </form>
  );
}

export function NumeracaoForm({ id, ultimo }: { id: string; ultimo: number }) {
  const [state, action] = useActionState(numeracaoAction, null);
  return (
    <form action={action} className="stack">
      <Feedback state={state} />
      <input type="hidden" name="id" value={id} />
      <label>Último número da NFS-e<input name="ultimoNumeroNfse" type="number" min={0} defaultValue={ultimo} /></label>
      <PendingButton>Ajustar numeração</PendingButton>
    </form>
  );
}

export function CertificateForm({ id }: { id: string }) {
  const [state, action] = useActionState(certificateAction, null);
  return (
    <form action={action} className="stack">
      <Feedback state={state} />
      <input type="hidden" name="id" value={id} />
      <label>Arquivo A1<input name="file" type="file" required /></label>
      <label>Senha<input name="password" type="password" required /></label>
      <p className="muted">A senha é descartada. O arquivo não é aberto nem usado para assinar.</p>
      <PendingButton>Guardar metadado</PendingButton>
    </form>
  );
}

export function LogoForm({ id }: { id: string }) {
  const [state, action] = useActionState(logoAction, null);
  return (
    <form action={action} className="stack">
      <Feedback state={state} />
      <input type="hidden" name="id" value={id} />
      <label>Logo PNG, JPEG ou WebP<input name="file" type="file" accept="image/png,image/jpeg,image/webp" required /></label>
      <PendingButton>Enviar logo</PendingButton>
    </form>
  );
}

export function NotaForm({ projects }: { projects: { id: string; name: string; cnpj: string }[] }) {
  const [state, action] = useActionState(emitNoteAction, null);
  return (
    <form action={action} className="stack">
      <Feedback state={state} />
      <label>Empresa
        <select name="projectId" required defaultValue={projects[0]?.id}>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>{project.name} · {project.cnpj}</option>
          ))}
        </select>
      </label>
      <div className="grid-2">
        <label>Tomador<input name="tomadorNome" required /></label>
        <label>CNPJ do tomador<input name="tomadorCnpj" /></label>
        <label>CPF do tomador<input name="tomadorCpf" /></label>
        <label>E-mail<input name="tomadorEmail" type="email" /></label>
        <label>Descrição do serviço<input name="descricao" required /></label>
        <label>Código do serviço<input name="codigo" placeholder="010700" /></label>
        <label>Valor total<input name="total" type="number" min="0.01" step="0.01" required /></label>
        <label>Alíquota ISS %<input name="aliquotaIss" type="number" min="0" max="100" step="0.01" required defaultValue="2" /></label>
        <label>Competência<input name="competencia" placeholder="2026-03" /></label>
        <label>Referência<input name="referencia" /></label>
      </div>
      <label className="checks"><input type="checkbox" name="issRetido" /> ISS retido pelo tomador</label>
      <label>Informações complementares<textarea name="informacoesComplementares" /></label>
      <fieldset>
        <legend>Cenário desta nota</legend>
        <div className="grid-2">
          <label>Resultado
            <select name="resultado" defaultValue="">
              <option value="">Sortear pela taxa da organização</option>
              <option value="sucesso">Forçar sucesso</option>
              <option value="rejeicao">Forçar rejeição</option>
              <option value="timeout">Forçar timeout</option>
              <option value="indisponivel">Forçar indisponível</option>
            </select>
          </label>
          <label>Atraso em ms<input name="atrasoMs" type="number" min="0" max="120000" placeholder="vazio usa o padrão" /></label>
        </div>
      </fieldset>
      <details>
        <summary>Grupos de estudo (exportação, obra, evento, retenções)</summary>
        <div className="grid-2" style={{ marginTop: "0.8rem" }}>
          <label>País do resultado<input name="paisResultado" placeholder="US" /></label>
          <label>Modo de prestação<input name="modoPrestacao" type="number" /></label>
          <label>Moeda BACEN<input name="codigoMoeda" /></label>
          <label>Valor na moeda<input name="valorServicoMoeda" type="number" step="0.01" /></label>
          <label>Código da obra<input name="codigoObra" /></label>
          <label>ART<input name="art" /></label>
          <label>Evento<input name="eventoNome" /></label>
          <label>Início<input name="dataInicio" type="date" /></label>
          <label>Fim<input name="dataFim" type="date" /></label>
          <label>Dedução
            <select name="deducaoModo" defaultValue="">
              <option value="">Sem dedução</option>
              <option value="percentual">Percentual</option>
              <option value="valor">Valor</option>
            </select>
          </label>
          <label>Valor da dedução<input name="deducaoValor" type="number" step="0.01" /></label>
          <label>IRRF<input name="retencaoIrrf" type="number" step="0.01" /></label>
          <label>INSS<input name="retencaoCp" type="number" step="0.01" /></label>
          <label>CSLL<input name="retencaoCsll" type="number" step="0.01" /></label>
          <label>CST IBS/CBS<input name="cstIbscbs" /></label>
          <label>Classificação<input name="classificacao" /></label>
          <label>NBS<input name="nbs" /></label>
        </div>
      </details>
      <PendingButton>Enfileirar NFS-e</PendingButton>
    </form>
  );
}

export function CancelForm({ invoiceId, projectId }: { invoiceId: string; projectId: string }) {
  const [state, action] = useActionState(cancelNoteAction, null);
  return (
    <form action={action} className="stack">
      <Feedback state={state} />
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <input type="hidden" name="projectId" value={projectId} />
      <label>Motivo<input name="motivo" placeholder="opcional, 15 a 255 caracteres" /></label>
      <div className="grid-2">
        <label>Código do motivo<input name="codigoMotivo" type="number" /></label>
        <label>Atraso ms<input name="atrasoMs" type="number" min="0" placeholder="padrão da organização" /></label>
      </div>
      <label>Resultado
        <select name="resultado" defaultValue="sucesso">
          <option value="">Sortear</option>
          <option value="sucesso">Aceitar cancelamento</option>
          <option value="rejeicao">Recusar</option>
          <option value="timeout">Timeout</option>
          <option value="indisponivel">Indisponível</option>
        </select>
      </label>
      <PendingButton>Pedir cancelamento</PendingButton>
    </form>
  );
}

export function KeyForm({ projects }: { projects: { id: string; name: string }[] }) {
  const [state, action] = useActionState(createKeyAction, null);
  return (
    <form action={action} className="stack">
      <Feedback state={state} />
      <label>Nome da chave<input name="name" required /></label>
      <label>Tipo
        <select name="kind" defaultValue="project">
          <option value="project">Chave de projeto</option>
          <option value="org">Token de organização</option>
        </select>
      </label>
      <label>Empresa
        <select name="projectId" defaultValue={projects[0]?.id ?? ""}>
          <option value="">Nenhuma (token de organização)</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>{project.name}</option>
          ))}
        </select>
      </label>
      <label>Limite por minuto<input name="rateLimitPerMinute" type="number" min={1} max={600} defaultValue={60} /></label>
      <PendingButton>Gerar chave</PendingButton>
    </form>
  );
}

export function WebhookForm({ projects }: { projects: { id: string; name: string }[] }) {
  const [state, action] = useActionState(createWebhookAction, null);
  return (
    <form action={action} className="stack">
      <Feedback state={state} />
      <label>Empresa
        <select name="projectId" required defaultValue={projects[0]?.id}>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>{project.name}</option>
          ))}
        </select>
      </label>
      <label>URL<input name="url" type="url" required placeholder="http://localhost:4000/hook" /></label>
      <label>Segredo HMAC<input name="secret" placeholder="opcional" /></label>
      <div className="checks">
        {NFSE_EVENTS.map((event) => (
          <label key={event}><input type="checkbox" name={event} defaultChecked={event !== "nfse.documents_ready"} /> {event}</label>
        ))}
      </div>
      <PendingButton>Cadastrar webhook</PendingButton>
    </form>
  );
}

export function TestWebhookForm({ id, projectId }: { id: string; projectId: string }) {
  const [state, action] = useActionState(testWebhookAction, null);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="projectId" value={projectId} />
      <PendingButton>Testar</PendingButton>
      {state?.error ? <p className="form-error">{state.error}</p> : null}
      {state?.ok ? <p className="banner-ok">{state.ok}</p> : null}
    </form>
  );
}

export function SimulationForm(props: { min: number; max: number; rate: number; retries: number[] }) {
  const [state, action] = useActionState(simulationAction, null);
  const [sample, sampleActionFn] = useActionState(sampleAction, null);
  return (
    <div className="stack">
      <form action={action} className="stack">
        <Feedback state={state} />
        <div className="grid-3">
          <label>Atraso mínimo (ms)<input name="latencyMinMs" type="number" min={0} defaultValue={props.min} /></label>
          <label>Atraso máximo (ms)<input name="latencyMaxMs" type="number" min={0} defaultValue={props.max} /></label>
          <label>Chance de falha (%)<input name="failureRate" type="number" min={0} max={100} defaultValue={props.rate} /></label>
          <label>Retry 1 (ms)<input name="retry1" type="number" min={0} defaultValue={props.retries[0] ?? 10000} /></label>
          <label>Retry 2 (ms)<input name="retry2" type="number" min={0} defaultValue={props.retries[1] ?? 30000} /></label>
          <label>Retry 3 (ms)<input name="retry3" type="number" min={0} defaultValue={props.retries[2] ?? 60000} /></label>
        </div>
        <PendingButton>Salvar simulação</PendingButton>
      </form>
      <form action={sampleActionFn} className="stack">
        <PendingButton>Sortear 10 resultados</PendingButton>
        {sample?.rolls ? <p>{sample.rolls.join(" · ")}</p> : null}
        {sample?.error ? <p className="form-error">{sample.error}</p> : null}
      </form>
    </div>
  );
}

export function StorageForm({ url }: { url: string | null }) {
  const [state, action] = useActionState(storageAction, null);
  return (
    <form action={action} className="stack">
      <Feedback state={state} />
      <label>Domínio https dos arquivos<input name="storageBaseUrl" type="url" defaultValue={url ?? ""} placeholder="https://arquivos.exemplo.test" /></label>
      <div className="row">
        <PendingButton>Salvar domínio</PendingButton>
        <button className="ghost" name="verificar" value="1">Simular verificação</button>
      </div>
    </form>
  );
}
