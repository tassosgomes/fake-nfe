import { withProject, studyJson } from "@/lib/api/http";
import { StudyError } from "@/lib/errors";
import { createInvoice } from "@/lib/services/invoices";
import { mergeSim, parseSimHeader } from "@/lib/simulation/decide";
import { validateEmit } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return withProject(
    req,
    "emit",
    async (auth, body, request) => {
      const validated = validateEmit(body);
      if ("error" in validated) throw new StudyError(400, "payload_invalido", validated.error, validated.campo);
      const sim = mergeSim(parseSimHeader(request.headers.get("x-simulacao")), validated.sim);
      if ("error" in sim) throw new StudyError(400, "simulacao_invalida", sim.error, "simulacao");
      const created = createInvoice({
        org: auth.organization,
        project: auth.project,
        emit: validated.data,
        sim,
        idempotencyKey: request.headers.get("idempotency-key"),
      });
      return studyJson(created.body, created.status);
    },
    { idempotent: true },
  );
}
