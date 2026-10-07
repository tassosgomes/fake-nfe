import { z } from "zod";
import { studyJson, withOrg } from "@/lib/api/http";
import { StudyError } from "@/lib/errors";
import { createApiKey, listKeys, publicKey } from "@/lib/services/keys";
import { requireProject } from "@/lib/services/projects";

export const dynamic = "force-dynamic";

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return withOrg(req, "api_keys:manage", async (auth) => {
    requireProject(id, auth.organization.id);
    return studyJson({ data: listKeys(auth.organization.id, id).map(publicKey) });
  });
}

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  rateLimitPerMinute: z.number().int().min(1).max(600).optional(),
});

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return withOrg(req, "api_keys:manage", async (auth, body) => {
    requireProject(id, auth.organization.id);
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new StudyError(400, "payload_invalido", "Informe o nome da chave.", "name");
    const created = createApiKey({
      organizationId: auth.organization.id,
      projectId: id,
      kind: "project",
      name: parsed.data.name,
      rateLimitPerMinute: parsed.data.rateLimitPerMinute,
    });
    return studyJson({ ...publicKey(created), key: created.key }, 201);
  });
}
