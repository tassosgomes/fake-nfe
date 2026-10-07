import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { CertificateForm, EmpresaForm, LogoForm, NumeracaoForm } from "@/components/forms";
import { deactivateEmpresaAction } from "@/lib/actions/panel";
import { formatWhen, parseJson } from "@/lib/format";
import { requireProject } from "@/lib/services/projects";

export const dynamic = "force-dynamic";

export default async function EmpresaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { org } = await requireSession();
  const project = (() => {
    try {
      return requireProject(id, org.id);
    } catch {
      return null;
    }
  })();
  if (!project || project.active !== 1) notFound();
  return (
    <div className="stack">
      <h1>{project.name}</h1>
      <p className="muted">Série {project.serieNfse}. Próxima NFS-e {project.ultimoNumeroNfse + 1}.</p>
      <EmpresaForm
        defaults={{
          id: project.id,
          name: project.name,
          cnpj: project.cnpj,
          razaoSocial: project.razaoSocial,
          inscricaoMunicipal: project.inscricaoMunicipal,
          inscricaoEstadual: project.inscricaoEstadual,
          regimeTributario: project.regimeTributario,
          codigoMunicipio: project.codigoMunicipio,
          email: project.email,
          telefone: project.telefone,
          description: project.description,
          endereco: parseJson(project.enderecoJson, {}),
          serieNfse: project.serieNfse,
          cnae: project.cnae,
          codigoServicoSp: project.codigoServicoSp,
          codigoTributacao: project.codigoTributacao,
          aliquotaSimples: project.aliquotaSimples,
          basicAuthUsuario: project.basicAuthUsuario,
          defaultNbs: project.defaultNbs,
          defaultCstIbscbs: project.defaultCstIbscbs,
          defaultClassificacao: project.defaultClassificacao,
          cstPisCofins: project.cstPisCofins,
          aliquotaPis: project.aliquotaPis,
          aliquotaCofins: project.aliquotaCofins,
          tributacaoIss: project.tributacaoIss,
        }}
      />
      <section className="card stack">
        <h2>Numeração</h2>
        <p className="muted">Um número menor que o atual é ignorado.</p>
        <NumeracaoForm id={project.id} ultimo={project.ultimoNumeroNfse} />
      </section>
      <section className="card stack">
        <h2>Certificado A1</h2>
        <p className="muted">
          {project.certFileName
            ? `${project.certFileName}, recebido em ${formatWhen(project.certUploadedAt)}. Não validado.`
            : "Nenhum arquivo registrado."}
        </p>
        <CertificateForm id={project.id} />
      </section>
      <section className="card stack">
        <h2>Logo</h2>
        <LogoForm id={project.id} />
      </section>
      <form action={deactivateEmpresaAction}>
        <input type="hidden" name="id" value={project.id} />
        <button className="danger" type="submit">Desativar empresa e revogar chaves</button>
      </form>
    </div>
  );
}
