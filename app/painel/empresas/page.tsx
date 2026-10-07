import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { formatCnpj } from "@/lib/cnpj";
import { REGIME_LABEL } from "@/lib/format";
import { hasApiKey, listProjects } from "@/lib/services/projects";

export const dynamic = "force-dynamic";

export default async function EmpresasPage() {
  const { org } = await requireSession();
  const companies = listProjects(org.id);
  return (
    <div className="stack">
      <div className="spread">
        <div>
          <h1>Empresas</h1>
          <p className="muted">{companies.length} de {org.projectLimit} CNPJs do plano de estudo.</p>
        </div>
        <Link className="button" href="/painel/empresas/nova">Nova empresa</Link>
      </div>
      <div className="stats">
        {companies.map((company) => (
          <Link key={company.id} href={`/painel/empresas/${company.id}`} className="card stat">
            <strong>{company.name}</strong>
            <span>{formatCnpj(company.cnpj)}</span>
            <span className="muted">{REGIME_LABEL[company.regimeTributario] ?? company.regimeTributario}</span>
            <span className="muted">Próximo número {company.ultimoNumeroNfse + 1} · certificado {company.certFileName ? "sim" : "não"} · chave {hasApiKey(company.id) ? "sim" : "não"}</span>
          </Link>
        ))}
      </div>
      {companies.length === 0 ? <p>Nenhuma empresa ativa.</p> : null}
    </div>
  );
}
