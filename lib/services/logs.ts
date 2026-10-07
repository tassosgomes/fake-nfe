import { and, desc, eq, gt } from "drizzle-orm";
import { getDb } from "../db/client";
import { requestLogs } from "../db/schema";
import { newId } from "../ids";

export function writeLog(entry: {
  organizationId?: string | null;
  projectId?: string | null;
  apiKeyId?: string | null;
  keyPrefix?: string | null;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  createdAt?: number;
}): void {
  const { db } = getDb();
  db.insert(requestLogs)
    .values({
      id: newId("log"),
      organizationId: entry.organizationId ?? null,
      projectId: entry.projectId ?? null,
      apiKeyId: entry.apiKeyId ?? null,
      keyPrefix: entry.keyPrefix ?? null,
      method: entry.method,
      path: entry.path,
      statusCode: entry.statusCode,
      durationMs: entry.durationMs,
      createdAt: entry.createdAt ?? Date.now(),
    })
    .run();
}

export function countRecent(apiKeyId: string, since: number): number {
  const { db } = getDb();
  const rows = db
    .select({ id: requestLogs.id })
    .from(requestLogs)
    .where(and(eq(requestLogs.apiKeyId, apiKeyId), gt(requestLogs.createdAt, since)))
    .all();
  return rows.length;
}

export function listLogs(organizationId: string, limit = 80) {
  const { db } = getDb();
  return db
    .select()
    .from(requestLogs)
    .where(eq(requestLogs.organizationId, organizationId))
    .orderBy(desc(requestLogs.createdAt))
    .limit(limit)
    .all();
}

export function pruneLogs(now = Date.now()): void {
  const { sqlite } = getDb();
  sqlite.prepare("DELETE FROM request_logs WHERE created_at < ?").run(now - 7 * 24 * 3600 * 1000);
}
