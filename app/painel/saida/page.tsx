import { desc, eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { emailOutbox } from "@/lib/db/schema";
import { formatWhen } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SaidaPage() {
  const { org } = await requireSession();
  const messages = getDb()
    .db.select()
    .from(emailOutbox)
    .where(eq(emailOutbox.organizationId, org.id))
    .orderBy(desc(emailOutbox.createdAt))
    .limit(50)
    .all();
  return (
    <div className="stack">
      <h1>Caixa de saída</h1>
      <p className="muted">E-mail do tomador não sai por SMTP. A mensagem fica aqui quando a nota simulada é emitida.</p>
      {messages.map((message) => (
        <article key={message.id} className="card stack">
          <strong>{message.subject}</strong>
          <span className="muted">{message.toEmail} · {formatWhen(message.createdAt)}</span>
          <p>{message.body}</p>
        </article>
      ))}
      {messages.length === 0 ? <p>Nenhuma mensagem.</p> : null}
    </div>
  );
}
