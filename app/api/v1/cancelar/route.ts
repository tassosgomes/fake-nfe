import { z } from "zod";
import { studyJson, withProject } from "@/lib/api/http";
import { StudyError } from "@/lib/errors";
import { requestCancel } from "@/lib/services/invoices";
import { mergeSim, parseSimHeader, parseSimObject } from "@/lib/simulation/decide";
import { SIM_RESULTS } from "@/lib/plan";

export const dynamic = "force-dynamic";

const schema = z.object({
  invoiceId: z.string().min(4),
  motivo: z.string().optional(),
  codigoMotivo: z.number().int().optional(),
  simulacao: z
    .object({
      resultado: z.enum(SIM_RESULTS).optional(),
      atrasoMs: z.number().int().min(0).max(120_000).optional(),
    })
    .optional(),
});

export async function POST(req: Request) {
  return withProject(
    req,
    "cancel",
    async (auth, body, request) => {
      const parsed = schema.safeParse(body);
      if (!parsed.success) {
        throw new StudyError(400, "payload_invalido", parsed.error.issues[0]?.message ?? "Payload inválido");
      }
      const sim = mergeSim(parseSimHeader(request.headers.get("x-simulacao")), parseSimObject(parsed.data.simulacao ?? {}));
      if ("error" in sim) throw new StudyError(400, "simulacao_invalida", sim.error, "simulacao");
      const result = requestCancel({
        org: auth.organization,
        project: auth.project,
        invoiceId: parsed.data.invoiceId,
        motivo: parsed.data.motivo,
        codigoMotivo: parsed.data.codigoMotivo,
        sim,
      });
      return studyJson(result.body, result.status);
    },
    { idempotent: true },
  );
}
