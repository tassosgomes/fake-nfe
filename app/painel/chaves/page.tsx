import { requireSession } from "@/lib/auth/session";
import { KeyForm } from "@/components/forms";
import { revokeKeyAction } from "@/lib/actions/panel";
import { formatWhen } from "@/lib/format";
import { listKeys } from "@/lib/services/keys";
import { listProjects } from "@/lib/services/projects";

export const dynamic = "force-dynamic";

export default async function ChavesPage() {
  const { org } = await requireSession();
  const keys = listKeys(org.id);
  const projects = listProjects(org.id).map((project) => ({ id: project.id, name: project.name }));
  return (
    <div className="stack">
      <h1>Chaves</h1>
      <p className="muted">A chave de projeto chama /api/v1/emitir. O token ntaas_org_ administra empresas. A chave completa aparece uma vez.</p>
      <KeyForm projects={projects} />
      <table>
        <thead><tr><th>Nome</th><th>Prefixo</th><th>Tipo</th><th>Limite</th><th>Uso</th><th></th></tr></thead>
        <tbody>
          {keys.map((key) => (
            <tr key={key.id}>
              <td>{key.name}{key.active ? "" : " (revogada)"}</td>
              <td>{key.keyPrefix}</td>
              <td>{key.kind === "org" ? "organização" : "projeto"}</td>
              <td>{key.rateLimitPerMinute}/min</td>
              <td>{formatWhen(key.lastUsedAt)}</td>
              <td>
                {key.active ? (
                  <form action={revokeKeyAction}>
                    <input type="hidden" name="id" value={key.id} />
                    <button className="ghost" type="submit">Revogar</button>
                  </form>
                ) : null}
              </td>
            </tr>
          ))}
          {keys.length === 0 ? <tr><td colSpan={6}>Nenhuma chave.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}
