import { requireSession } from "@/lib/auth/session";
import { TestWebhookForm, WebhookForm } from "@/components/forms";
import { deleteWebhookAction } from "@/lib/actions/panel";
import { formatWhen, parseJson } from "@/lib/format";
import { listProjects } from "@/lib/services/projects";
import { listDeliveries, listEndpointsByOrg } from "@/lib/services/webhooks";

export const dynamic = "force-dynamic";

export default async function WebhooksPage() {
  const { org } = await requireSession();
  const projects = listProjects(org.id).map((project) => ({ id: project.id, name: project.name }));
  const endpoints = listEndpointsByOrg(org.id);
  const deliveries = listDeliveries(org.id);
  return (
    <div className="stack">
      <h1>Webhooks</h1>
      <p className="muted">O POST sai quando o estado muda, assinado com HMAC se houver segredo. Localhost é aceito. Retentativas: imediata e depois as três esperas da simulação.</p>
      {projects.length === 0 ? <p>Cadastre uma empresa para receber eventos.</p> : <WebhookForm projects={projects} />}
      <table>
        <thead><tr><th>URL</th><th>Eventos</th><th></th></tr></thead>
        <tbody>
          {endpoints.map((endpoint) => (
            <tr key={endpoint.id}>
              <td>{endpoint.url}{endpoint.active ? "" : " (inativo)"}</td>
              <td>{parseJson<string[]>(endpoint.eventsJson, []).join(", ")}</td>
              <td className="row">
                <TestWebhookForm id={endpoint.id} projectId={endpoint.projectId} />
                <form action={deleteWebhookAction}>
                  <input type="hidden" name="id" value={endpoint.id} />
                  <input type="hidden" name="projectId" value={endpoint.projectId} />
                  <button className="ghost" type="submit">Apagar</button>
                </form>
              </td>
            </tr>
          ))}
          {endpoints.length === 0 ? <tr><td colSpan={3}>Nenhum endpoint.</td></tr> : null}
        </tbody>
      </table>
      <h2>Entregas</h2>
      <table>
        <thead><tr><th>Quando</th><th>Evento</th><th>Estado</th><th>Tentativas</th><th>Erro</th></tr></thead>
        <tbody>
          {deliveries.map((delivery) => (
            <tr key={delivery.id}>
              <td>{formatWhen(delivery.createdAt)}</td>
              <td>{delivery.event}</td>
              <td>{delivery.status}</td>
              <td>{delivery.attempts}</td>
              <td>{delivery.lastError ?? "—"}</td>
            </tr>
          ))}
          {deliveries.length === 0 ? <tr><td colSpan={5}>Nenhuma entrega.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}
