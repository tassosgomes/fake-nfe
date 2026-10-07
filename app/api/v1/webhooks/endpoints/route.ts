import { studyJson, withProject } from "@/lib/api/http";
import { StudyError } from "@/lib/errors";
import { createEndpoint, listEndpoints, publicEndpoint } from "@/lib/services/webhooks";
import { webhookSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return withProject(req, "webhooks", async (auth) => {
    return studyJson({ data: listEndpoints(auth.project.id).map(publicEndpoint) });
  });
}

export async function POST(req: Request) {
  return withProject(req, "webhooks", async (auth, body) => {
    const parsed = webhookSchema.safeParse(body);
    if (!parsed.success) throw new StudyError(400, "payload_invalido", parsed.error.issues[0]?.message ?? "Payload inválido");
    const created = createEndpoint({
      organizationId: auth.organization.id,
      projectId: auth.project.id,
      url: parsed.data.url,
      events: parsed.data.events,
      secret: parsed.data.secret,
      active: parsed.data.active,
    });
    return studyJson({ ...publicEndpoint(created), secret: created.secret }, 201);
  });
}
