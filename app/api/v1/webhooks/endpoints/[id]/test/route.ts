import { studyJson, withProject } from "@/lib/api/http";
import { enqueueTest } from "@/lib/services/webhooks";

export const dynamic = "force-dynamic";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return withProject(req, "webhooks", async (auth) => {
    return studyJson(enqueueTest(id, auth.project.id), 202);
  });
}
