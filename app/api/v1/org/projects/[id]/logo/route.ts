import { studyJson, withOrg } from "@/lib/api/http";
import { StudyError } from "@/lib/errors";
import { removeLogo, saveLogo } from "@/lib/services/projects";

export const dynamic = "force-dynamic";

async function dataUrlFromFile(file: File): Promise<string> {
  if (file.size > 500 * 1024) throw new StudyError(413, "logo_grande", "A logo passa de 500 KB.");
  const bytes = Buffer.from(await file.arrayBuffer());
  const type = file.type === "image/jpg" ? "image/jpeg" : file.type;
  return `data:${type};base64,${bytes.toString("base64")}`;
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return withOrg(req, "projects:write", async (auth, _body, request) => {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new StudyError(400, "logo_invalida", "Envie a imagem da logo.", "file");
    return studyJson(saveLogo(id, auth.organization.id, await dataUrlFromFile(file)), 201);
  });
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return withOrg(req, "projects:write", async (auth) => {
    return studyJson(removeLogo(id, auth.organization.id));
  });
}
