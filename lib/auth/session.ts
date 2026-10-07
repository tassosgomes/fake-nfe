import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { sessions } from "../db/schema";
import { newId } from "../ids";
import { getOrgByOwner, getUser } from "../services/accounts";

const COOKIE = "estudo_session";
const WEEK = 7 * 24 * 3600 * 1000;

export async function createSession(userId: string): Promise<void> {
  const id = newId("ses");
  const expiresAt = Date.now() + WEEK;
  getDb().db.insert(sessions).values({ id, userId, expiresAt }).run();
  const jar = await cookies();
  jar.set(COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  const id = jar.get(COOKIE)?.value;
  if (id) getDb().db.delete(sessions).where(eq(sessions.id, id)).run();
  jar.delete(COOKIE);
}

export async function getSession() {
  const jar = await cookies();
  const id = jar.get(COOKIE)?.value;
  if (!id) return null;
  const row = getDb().db.select().from(sessions).where(eq(sessions.id, id)).get();
  if (!row || row.expiresAt < Date.now()) return null;
  const user = getUser(row.userId);
  const org = user ? getOrgByOwner(user.id) : undefined;
  if (!user || !org) return null;
  return { user, org };
}

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
