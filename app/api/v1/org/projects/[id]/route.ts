import { studyJson, withOrg } from "@/lib/api/http";
import { StudyError } from "@/lib/errors";
import { deactivateProject, publicProject, requireProject, updateProject } from "@/lib/services/projects";
import { projectPatchSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return withOrg(req, "projects:read", async (auth) => {
    return studyJson(publicProject(requireProject(id, auth.organization.id), true));
  });
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return withOrg(req, "projects:write", async (auth, body) => {
    const parsed = projectPatchSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new StudyError(400, "payload_invalido", issue?.message ?? "Payload inválido", issue?.path.join("."));
    }
    const updated = updateProject(id, auth.organization.id, parsed.data);
    return studyJson({ updated: true, id: updated.id, project: publicProject(updated, true) });
  });
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return withOrg(req, "projects:write", async (auth) => {
    deactivateProject(id, auth.organization.id);
    return new Response(null, { status: 204, headers: { "X-Ambiente": "estudo", "X-Aviso": "sem-valor-fiscal" } });
  });
}
