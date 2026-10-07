import { studyBinary, withProject } from "@/lib/api/http";
import { StudyError } from "@/lib/errors";
import { buildPdf } from "@/lib/nfse/documents";
import { getInvoice } from "@/lib/services/invoices";

export const dynamic = "force-dynamic";

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return withProject(req, "query", async (auth) => {
    const invoice = getInvoice(id, auth.project.id);
    if (!invoice) throw new StudyError(404, "nao_encontrado", "Nota não encontrada neste projeto.");
    if (invoice.status !== "issued" && invoice.status !== "cancelled") {
      throw new StudyError(409, "documento_indisponivel", "O PDF só fica disponível depois da emissão simulada.");
    }
    const pdf = await buildPdf(invoice, auth.project);
    const numero = invoice.numeroNfse ?? "rascunho";
    return studyBinary(Buffer.from(pdf), "application/pdf", `nfse-estudo-${numero}.pdf`, "inline");
  });
}
