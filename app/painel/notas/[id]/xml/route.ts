import { getSession } from "@/lib/auth/session";
import { studyBinary } from "@/lib/api/http";
import { buildXml } from "@/lib/nfse/documents";
import { getInvoiceInOrg } from "@/lib/services/invoices";
import { requireProject } from "@/lib/services/projects";

export const dynamic = "force-dynamic";

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return new Response("Entre para baixar o XML.", { status: 401 });
  const { id } = await context.params;
  const invoice = getInvoiceInOrg(id, session.org.id);
  const kind = new URL(req.url).searchParams.get("type") === "cancel" ? "cancel" : "emission";
  if (!invoice) return new Response("Nota não encontrada.", { status: 404 });
  if (kind === "cancel" && invoice.status !== "cancelled") return new Response("Cancelamento ainda não concluído.", { status: 409 });
  if (kind === "emission" && invoice.status !== "issued" && invoice.status !== "cancelled") {
    return new Response("XML indisponível.", { status: 409 });
  }
  const project = requireProject(invoice.projectId, session.org.id);
  const xml = buildXml(invoice, project, kind);
  return studyBinary(xml, "application/xml; charset=utf-8", `nfse-estudo-${invoice.numeroNfse ?? "nota"}.xml`, "attachment");
}
