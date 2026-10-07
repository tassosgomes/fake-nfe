import { getSession } from "@/lib/auth/session";
import { studyBinary } from "@/lib/api/http";
import { buildPdf } from "@/lib/nfse/documents";
import { getInvoiceInOrg } from "@/lib/services/invoices";
import { requireProject } from "@/lib/services/projects";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return new Response("Entre para baixar o PDF.", { status: 401 });
  const { id } = await context.params;
  const invoice = getInvoiceInOrg(id, session.org.id);
  if (!invoice || (invoice.status !== "issued" && invoice.status !== "cancelled")) {
    return new Response("PDF indisponível.", { status: 404 });
  }
  const project = requireProject(invoice.projectId, session.org.id);
  const pdf = await buildPdf(invoice, project);
  return studyBinary(Buffer.from(pdf), "application/pdf", `nfse-estudo-${invoice.numeroNfse ?? "nota"}.pdf`, "inline");
}
