import { z } from "zod";
import { studyJson, withOrg } from "@/lib/api/http";
import { StudyError } from "@/lib/errors";
import { publicSettings, simulateVerification, updateStorage } from "@/lib/services/settings";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return withOrg(req, "settings:read", async (auth) => studyJson(publicSettings(auth.organization)));
}

const schema = z.object({
  storageBaseUrl: z.string().url().nullable(),
  simularVerificacao: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  return withOrg(req, "settings:write", async (auth, body) => {
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new StudyError(400, "payload_invalido", "Informe storageBaseUrl.", "storageBaseUrl");
    const saved = updateStorage(auth.organization.id, parsed.data.storageBaseUrl);
    if (parsed.data.simularVerificacao) return studyJson(simulateVerification(auth.organization.id));
    return studyJson(saved);
  });
}
