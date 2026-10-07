import { requireSession } from "@/lib/auth/session";
import { formatWhen } from "@/lib/format";
import { listLogs } from "@/lib/services/logs";

export const dynamic = "force-dynamic";

export default async function LogsPage() {
  const { org } = await requireSession();
  const logs = listLogs(org.id);
  return (
    <div className="stack">
      <h1>Logs</h1>
      <p className="muted">Cada chamada de API e cada emissão pelo painel. A chave completa não é gravada.</p>
      <table>
        <thead><tr><th>Quando</th><th>Método</th><th>Caminho</th><th>Status</th><th>ms</th><th>Chave</th></tr></thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td>{formatWhen(log.createdAt)}</td>
              <td>{log.method}</td>
              <td>{log.path}</td>
              <td>{log.statusCode}</td>
              <td>{log.durationMs}</td>
              <td>{log.keyPrefix ?? "—"}</td>
            </tr>
          ))}
          {logs.length === 0 ? <tr><td colSpan={6}>Nenhuma requisição ainda.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}
