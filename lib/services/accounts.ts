import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { organizations, users } from "../db/schema";
import { StudyError } from "../errors";
import { newId, slugify } from "../ids";
import { STUDY_PLAN } from "../plan";

export function registerAccount(input: { name: string; email: string; password: string; organizationName: string }) {
  const email = input.email.trim().toLowerCase();
  if (input.password.length < 8) {
    throw new StudyError(400, "senha_curta", "A senha precisa ter pelo menos 8 caracteres.", "password");
  }
  const { db } = getDb();
  const existing = db.select().from(users).where(eq(users.email, email)).get();
  if (existing) throw new StudyError(409, "email_em_uso", "Já existe uma conta com este e-mail.", "email");
  const now = Date.now();
  const userId = newId("usr");
  const orgId = newId("org");
  db.transaction(() => {
    db.insert(users)
      .values({
        id: userId,
        name: input.name.trim(),
        email,
        passwordHash: bcrypt.hashSync(input.password, 10),
        createdAt: now,
      })
      .run();
    db.insert(organizations)
      .values({
        id: orgId,
        ownerUserId: userId,
        name: input.organizationName.trim(),
        slug: slugify(input.organizationName),
        creditsUsed: 0,
        creditsLimit: STUDY_PLAN.creditsLimit,
        projectLimit: STUDY_PLAN.projectLimit,
        latencyMinMs: 2000,
        latencyMaxMs: 6000,
        failureRate: 15,
        retryDelaysJson: "[10000,30000,60000]",
        storageBaseUrl: null,
        storageStatus: "none",
        createdAt: now,
      })
      .run();
  });
  return { userId, orgId };
}

export function authenticate(email: string, password: string) {
  const user = getDb().db.select().from(users).where(eq(users.email, email.trim().toLowerCase())).get();
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    throw new StudyError(401, "credencial_invalida", "E-mail ou senha não conferem.");
  }
  const org = getDb().db.select().from(organizations).where(eq(organizations.ownerUserId, user.id)).get();
  if (!org) throw new StudyError(401, "organizacao_ausente", "Esta conta não tem organização.");
  return { user, org };
}

export function getUser(id: string) {
  return getDb().db.select().from(users).where(eq(users.id, id)).get();
}

export function getOrgByOwner(userId: string) {
  return getDb().db.select().from(organizations).where(eq(organizations.ownerUserId, userId)).get();
}

export function getOrg(id: string) {
  return getDb().db.select().from(organizations).where(eq(organizations.id, id)).get();
}
