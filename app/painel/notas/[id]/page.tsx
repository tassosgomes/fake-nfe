import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { AutoRefresh } from "@/components/auto-refresh";
import { Badge } from "@/components/badge";
import { CancelForm } from "@/components/forms";
import { RESULT_LABEL, formatBRL, formatWhen, parseJson } from "@/lib/format";
import { getInvoiceInOrg, invoiceTimeline } from "@/lib/services/invoices";

export const dynamic = "force-dynamic";

export default async function NotaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { org } = await requireSession();
  const invoice = getInvoiceInOrg(id, org.id);
  if (!invoice) notFound();
  const waiting = invoice.status === "queued" || invoice.status === "processing" || invoice.status === "cancel_queued";
  const payload = parseJson<Record<string, unknown>>(invoice.payloadJson, {});
  return (
    <div className="stack">
      <AutoRefresh active={waiting} />
      <div className="spread">
        <div>
          <h1>{invoice.numeroNfse ? `NFS-e ${invoice.numeroNfse}` : "Nota na fila"}</h1>
          <p className="muted">{invoice.id}</p>
        </div>
        <Badge status={invoice.status} />
      </div>
      <section className="card stack">
        <p>Tomador <strong>{invoice.tomadorNome}</strong> · {formatBRL(invoice.valorTotal)} · competência {invoice.competencia}</p>
        <p>Cenário {invoice.simSource}: <strong>{RESULT_LABEL[invoice.simResult] ?? invoice.simResult}</strong>. Atraso previsto {invoice.simDelayMs} ms. Conclusão {formatWhen(invoice.readyAt)}.</p>
        {invoice.chNfse ? <p>Código interno <strong>{invoice.chNfse}</strong>. Não é chave oficial.</p> : null}
        {invoice.errorMessage ? <p className="form-error">{invoice.errorCode}: {invoice.errorMessage}</p> : null}
        {invoice.cancelError ? <p className="form-error">{invoice.cancelError}</p> : null}
        <div className="row">
          {invoice.status === "issued" || invoice.status === "cancelled" ? (
            <>
              <a className="button" href={`/painel/notas/${invoice.id}/pdf`}>PDF de estudo</a>
              <a className="button ghost" href={`/painel/notas/${invoice.id}/xml`}>XML de estudo</a>
            </>
          ) : null}
          {invoice.status === "cancelled" ? <a className="button ghost" href={`/painel/notas/${invoice.id}/xml?type=cancel`}>XML de cancelamento</a> : null}
        </div>
      </section>
      <h2>Linha do tempo</h2>
      <ol className="timeline">
        {invoiceTimeline(invoice).map((event) => (
          <li key={`${event.em}-${event.titulo}`}>
            <strong>{event.titulo}</strong>
            <div className="muted">{formatWhen(event.em)}</div>
            <div>{event.detalhe}</div>
          </li>
        ))}
      </ol>
      {invoice.status === "issued" ? (
        <section className="card">
          <h2>Cancelar</h2>
          <CancelForm invoiceId={invoice.id} projectId={invoice.projectId} />
        </section>
      ) : null}
      <h2>Payload guardado</h2>
      <pre className="keybox">{JSON.stringify(payload, null, 2)}</pre>
      <p><Link href="/painel/notas">Voltar às notas</Link></p>
    </div>
  );
}
