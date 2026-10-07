import { studyJson, withOrg } from "@/lib/api/http";
import { StudyError } from "@/lib/errors";
import { saveCertificate } from "@/lib/services/projects";

export const dynamic = "force-dynamic";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return withOrg(req, "certificates:write", async (auth, _body, request) => {
    const form = await request.formData();
    const file = form.get("file");
    const password = form.get("password");
    if (!(file instanceof File) || file.size === 0) {
      throw new StudyError(400, "arquivo_invalido", "Envie o arquivo do certificado A1.", "file");
    }
    if (file.size > 50 * 1024) throw new StudyError(413, "arquivo_grande", "O arquivo passa de 50 KB.");
    if (typeof password !== "string" || password.length === 0) {
      throw new StudyError(400, "senha_ausente", "Informe a senha. Ela será descartada e não abre o arquivo.", "password");
    }
    return studyJson(saveCertificate(id, auth.organization.id, file.name), 201);
  });
}
