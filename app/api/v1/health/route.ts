import { studyJson, withPublic } from "@/lib/api/http";
import { getDb } from "@/lib/db/client";
import { StudyError } from "@/lib/errors";
import { STUDY_AVISO } from "@/lib/plan";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return withPublic(req, () => {
    try {
      getDb().sqlite.prepare("SELECT 1").get();
    } catch {
      throw new StudyError(503, "banco_indisponivel", "O banco de estudo não respondeu.");
    }
    return studyJson({ status: "ok", ambiente: "estudo", banco: "ok", aviso: STUDY_AVISO }, 200, { "Cache-Control": "no-store" });
  });
}
