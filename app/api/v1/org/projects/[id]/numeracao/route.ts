import { z } from "zod";
import { studyJson, withOrg } from "@/lib/api/http";
import { StudyError } from "@/lib/errors";
import { numeracaoOf, requireProject, setNumeracao } from "@/lib/services/projects";

export const dynamic = "force-dynamic";

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return withOrg(req, "projects:read", async (auth) => {
    return studyJson(numeracaoOf(requireProject(id, auth.organization.id)));
  });
}

const patchSchema = z.object({ ultimoNumeroNfse: z.number().int().min(0) });

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return withOrg(req, "projects:write", async (auth, body) => {
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) throw new StudyError(400, "payload_invalido", "Informe ultimoNumeroNfse.", "ultimoNumeroNfse");
    return studyJson(setNumeracao(id, auth.organization.id, parsed.data.ultimoNumeroNfse));
  });
}
