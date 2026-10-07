import { requireSession } from "@/lib/auth/session";
import { StorageForm } from "@/components/forms";

export const dynamic = "force-dynamic";

export default async function UsoPage() {
  const { org } = await requireSession();
  const used = Math.min(100, Math.round((org.creditsUsed / Math.max(1, org.creditsLimit)) * 100));
  return (
    <div className="stack">
      <h1>Plano Estudo</h1>
      <p className="muted">Não há cobrança. Cada nota emitida consome 1 crédito. Erro simulado não consome.</p>
      <section className="card stat">
        <strong>{org.creditsUsed} / {org.creditsLimit}</strong>
        <span className="muted">notas emitidas</span>
        <div className="meter"><span style={{ width: `${used}%` }} /></div>
      </section>
      <section className="card stack">
        <h2>Domínio dos arquivos</h2>
        <p className="muted">Status atual: {org.storageStatus}. A verificação não consulta DNS.</p>
        <StorageForm url={org.storageBaseUrl} />
      </section>
      <p className="muted">A documentação do laboratório está na pasta docs do projeto, em Markdown.</p>
    </div>
  );
}
