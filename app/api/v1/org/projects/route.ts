import { studyJson, withOrg } from "@/lib/api/http";
import { StudyError } from "@/lib/errors";
import { createProject, hasApiKey, listProjects, publicProject } from "@/lib/services/projects";
import { projectSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return withOrg(req, "projects:read", async (auth, _body, request) => {
    const params = new URL(request.url).searchParams;
    const includeInactive = params.get("active") === "false" || params.get("active") === "all";
    const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.get("limit") ?? 20) || 20));
    const all = listProjects(auth.organization.id, includeInactive);
    const slice = all.slice((page - 1) * limit, page * limit);
    return studyJson({
      data: slice.map((row) => ({
        id: row.id,
        name: row.name,
        cnpj: row.cnpj,
        codigoMunicipio: row.codigoMunicipio,
        active: row.active === 1,
        hasCertificate: Boolean(row.certFileName),
        hasApiKey: hasApiKey(row.id),
        proximoNumeroNfse: row.ultimoNumeroNfse + 1,
        createdAt: new Date(row.createdAt).toISOString(),
      })),
      pagination: { page, limit, total: all.length },
    });
  });
}

export async function POST(req: Request) {
  return withOrg(req, "projects:write", async (auth, body) => {
    const parsed = projectSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new StudyError(400, "payload_invalido", issue?.message ?? "Payload inválido", issue?.path.join("."));
    }
    const created = createProject(auth.organization.id, parsed.data);
    return studyJson(publicProject(created), 201);
  });
}
