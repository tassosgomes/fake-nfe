import { studyJson, withOrg } from "@/lib/api/http";
import { revokeKey } from "@/lib/services/keys";
import { requireProject } from "@/lib/services/projects";

export const dynamic = "force-dynamic";

export async function DELETE(req: Request, context: { params: Promise<{ id: string; keyId: string }> }) {
  const { id, keyId } = await context.params;
  return withOrg(req, "api_keys:manage", async (auth) => {
    requireProject(id, auth.organization.id);
    revokeKey(keyId, auth.organization.id);
    return studyJson({ revoked: true, id: keyId });
  });
}
