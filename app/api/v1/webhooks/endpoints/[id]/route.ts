import { studyJson, withProject } from "@/lib/api/http";
import { StudyError } from "@/lib/errors";
import { deleteEndpoint, publicEndpoint, updateEndpoint } from "@/lib/services/webhooks";
import { webhookSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return withProject(req, "webhooks", async (auth, body) => {
    const parsed = webhookSchema.partial().safeParse(body);
    if (!parsed.success) throw new StudyError(400, "payload_invalido", parsed.error.issues[0]?.message ?? "Payload inválido");
    const updated = updateEndpoint(id, auth.project.id, parsed.data);
    return studyJson(publicEndpoint(updated));
  });
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return withProject(req, "webhooks", async (auth) => {
    deleteEndpoint(id, auth.project.id);
    return studyJson({ deleted: true });
  });
}
