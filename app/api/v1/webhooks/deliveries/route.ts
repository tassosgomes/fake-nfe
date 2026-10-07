import { studyJson, withProject } from "@/lib/api/http";
import { listDeliveries } from "@/lib/services/webhooks";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return withProject(req, "webhooks", async (auth, _body, request) => {
    const limit = Number(new URL(request.url).searchParams.get("limit") ?? 50);
    const rows = listDeliveries(auth.organization.id, auth.project.id, Number.isFinite(limit) ? Math.min(limit, 100) : 50);
    return studyJson({
      data: rows.map((row) => ({
        id: row.id,
        endpointId: row.endpointId,
        invoiceId: row.invoiceId,
        event: row.event,
        url: row.url,
        status: row.status,
        attempts: row.attempts,
        nextAttemptAt: new Date(row.nextAttemptAt).toISOString(),
        lastStatusCode: row.lastStatusCode,
        lastError: row.lastError,
        createdAt: new Date(row.createdAt).toISOString(),
      })),
    });
  });
}
