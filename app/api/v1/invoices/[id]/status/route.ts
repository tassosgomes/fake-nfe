import { studyJson, withProject } from "@/lib/api/http";
import { StudyError } from "@/lib/errors";
import { getInvoice, publicInvoice } from "@/lib/services/invoices";

export const dynamic = "force-dynamic";

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return withProject(req, "query", async (auth, _body, request) => {
    const invoice = getInvoice(id, auth.project.id);
    if (!invoice) throw new StudyError(404, "nao_encontrado", "Nota não encontrada neste projeto.");
    return studyJson(publicInvoice(invoice, new URL(request.url).origin));
  });
}
