import { studyBinary, withProject } from "@/lib/api/http";
import { StudyError } from "@/lib/errors";
import { buildXml } from "@/lib/nfse/documents";
import { getInvoice } from "@/lib/services/invoices";

export const dynamic = "force-dynamic";

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return withProject(req, "query", async (auth, _body, request) => {
    const invoice = getInvoice(id, auth.project.id);
    if (!invoice) throw new StudyError(404, "nao_encontrado", "Nota não encontrada neste projeto.");
    const kind = new URL(request.url).searchParams.get("type") === "cancel" ? "cancel" : "emission";
    if (kind === "cancel" && invoice.status !== "cancelled") {
      throw new StudyError(409, "documento_indisponivel", "O XML de cancelamento só existe para nota cancelada.");
    }
    if (kind === "emission" && invoice.status !== "issued" && invoice.status !== "cancelled") {
      throw new StudyError(409, "documento_indisponivel", "O XML só fica disponível depois da emissão simulada.");
    }
    const xml = buildXml(invoice, auth.project, kind);
    const numero = invoice.numeroNfse ?? "rascunho";
    return studyBinary(xml, "application/xml; charset=utf-8", `nfse-estudo-${numero}${kind === "cancel" ? "-cancel" : ""}.xml`, "attachment");
  });
}
