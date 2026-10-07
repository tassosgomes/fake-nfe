import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { NotaForm } from "@/components/forms";
import { listProjects } from "@/lib/services/projects";

export const dynamic = "force-dynamic";

export default async function NovaNotaPage() {
  const { org } = await requireSession();
  const projects = listProjects(org.id).map((project) => ({ id: project.id, name: project.name, cnpj: project.cnpj }));
  return (
    <div className="stack">
      <h1>Nova NFS-e</h1>
      <p className="muted">O pedido entra na fila. Sucesso, rejeição, timeout e indisponibilidade são decididos aqui, sem sair do servidor.</p>
      {projects.length === 0 ? (
        <div className="card">
          <p>Cadastre uma empresa antes de emitir.</p>
          <Link className="button" href="/painel/empresas/nova">Cadastrar empresa</Link>
        </div>
      ) : (
        <NotaForm projects={projects} />
      )}
    </div>
  );
}
