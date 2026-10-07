import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { AutoRefresh } from "@/components/auto-refresh";
import { Badge } from "@/components/badge";
import { formatBRL, formatWhen } from "@/lib/format";
import { listInvoices } from "@/lib/services/invoices";

export const dynamic = "force-dynamic";

export default async function NotasPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const { org } = await requireSession();
  const filters = await searchParams;
  const notes = listInvoices(org.id, { status: filters.status || undefined, q: filters.q || undefined });
  const waiting = notes.some((note) => note.status === "queued" || note.status === "processing" || note.status === "cancel_queued");
  return (
    <div className="stack">
      <AutoRefresh active={waiting} />
      <div className="spread">
        <h1>Notas</h1>
        <Link className="button" href="/painel/notas/nova">Nova NFS-e</Link>
      </div>
      <form className="row" method="get">
        <select name="status" defaultValue={filters.status ?? ""}>
          <option value="">Todos os estados</option>
          <option value="queued">Na fila</option>
          <option value="processing">Processando</option>
          <option value="issued">Emitida</option>
          <option value="error">Erro</option>
          <option value="cancel_queued">Cancelamento na fila</option>
          <option value="cancelled">Cancelada</option>
        </select>
        <input name="q" placeholder="tomador, número ou referência" defaultValue={filters.q ?? ""} />
        <button type="submit">Filtrar</button>
      </form>
      <table>
        <thead><tr><th>Nota</th><th>Tomador</th><th>Valor</th><th>Estado</th><th>Quando</th></tr></thead>
        <tbody>
          {notes.map((note) => (
            <tr key={note.id}>
              <td><Link href={`/painel/notas/${note.id}`}>{note.numeroNfse ?? note.id}</Link></td>
              <td>{note.tomadorNome}</td>
              <td>{formatBRL(note.valorTotal)}</td>
              <td><Badge status={note.status} /></td>
              <td>{formatWhen(note.createdAt)}</td>
            </tr>
          ))}
          {notes.length === 0 ? <tr><td colSpan={5}>Nenhuma nota com esse filtro.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}
