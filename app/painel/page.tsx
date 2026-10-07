import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { Badge } from "@/components/badge";
import { formatBRL, formatWhen } from "@/lib/format";
import { listInvoices } from "@/lib/services/invoices";
import { listProjects } from "@/lib/services/projects";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { org } = await requireSession();
  const companies = listProjects(org.id);
  const notes = listInvoices(org.id, {});
  const failures = notes.filter((note) => note.status === "error").slice(0, 5);
  const used = Math.min(100, Math.round((org.creditsUsed / org.creditsLimit) * 100));
  return (
    <div className="stack">
      <div className="spread">
        <div>
          <h1>Laboratório</h1>
          <p className="muted">A fila imita a espera de uma prefeitura. O relógio é local e o resultado pode falhar de propósito.</p>
        </div>
        <Link className="button" href="/painel/notas/nova">Nova NFS-e</Link>
      </div>
      <section className="stats">
        <article className="card stat"><span className="muted">Notas emitidas</span><strong>{org.creditsUsed}/{org.creditsLimit}</strong></article>
        <article className="card stat"><span className="muted">Empresas</span><strong>{companies.length}/{org.projectLimit}</strong></article>
        <article className="card stat"><span className="muted">Falhas recentes</span><strong>{failures.length}</strong></article>
      </section>
      <div className="meter" aria-hidden="true"><span style={{ width: `${used}%` }} /></div>
      {companies.length === 0 ? (
        <div className="card">
          <h2>Comece por uma empresa</h2>
          <p>O plano de estudo cabe até {org.projectLimit} CNPJs. Cadastre o prestador antes de emitir.</p>
          <Link className="button" href="/painel/empresas/nova">Cadastrar empresa</Link>
        </div>
      ) : null}
      <h2>Notas recentes</h2>
      <table>
        <thead><tr><th>Quando</th><th>Tomador</th><th>Valor</th><th>Estado</th></tr></thead>
        <tbody>
          {notes.slice(0, 8).map((note) => (
            <tr key={note.id}>
              <td><Link href={`/painel/notas/${note.id}`}>{formatWhen(note.createdAt)}</Link></td>
              <td>{note.tomadorNome}</td>
              <td>{formatBRL(note.valorTotal)}</td>
              <td><Badge status={note.status} /></td>
            </tr>
          ))}
          {notes.length === 0 ? <tr><td colSpan={4}>Nenhuma nota ainda.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}
