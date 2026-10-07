import { mkdirSync } from "fs";
import path from "path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const MIGRATION = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  credits_used INTEGER NOT NULL DEFAULT 0,
  credits_limit INTEGER NOT NULL DEFAULT 50,
  project_limit INTEGER NOT NULL DEFAULT 5,
  latency_min_ms INTEGER NOT NULL DEFAULT 2000,
  latency_max_ms INTEGER NOT NULL DEFAULT 6000,
  failure_rate INTEGER NOT NULL DEFAULT 15,
  retry_delays_json TEXT NOT NULL DEFAULT '[10000,30000,60000]',
  storage_base_url TEXT,
  storage_status TEXT NOT NULL DEFAULT 'none',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  cnpj TEXT NOT NULL,
  razao_social TEXT NOT NULL,
  inscricao_municipal TEXT,
  inscricao_estadual TEXT,
  regime_tributario TEXT NOT NULL DEFAULT '3',
  codigo_municipio TEXT,
  email TEXT,
  telefone TEXT,
  description TEXT,
  endereco_json TEXT NOT NULL DEFAULT '{}',
  codigo_tributacao TEXT,
  tributacao_iss INTEGER DEFAULT 1,
  serie_nfse TEXT NOT NULL DEFAULT '1608',
  aliquota_simples REAL,
  regime_iss INTEGER,
  codigo_servico_sp TEXT,
  cnae TEXT,
  basic_auth_usuario TEXT,
  basic_auth_senha TEXT,
  ultimo_numero_nfse INTEGER NOT NULL DEFAULT 0,
  default_nbs TEXT,
  default_cst_ibscbs TEXT,
  default_classificacao TEXT,
  default_indicador TEXT,
  cst_pis_cofins TEXT,
  aliquota_pis REAL,
  aliquota_cofins REAL,
  active INTEGER NOT NULL DEFAULT 1,
  cert_file_name TEXT,
  cert_uploaded_at INTEGER,
  logo_data_url TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_cnpj_active
  ON projects(organization_id, cnpj) WHERE active = 1;
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  scopes_json TEXT NOT NULL,
  rate_limit_per_minute INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  last_used_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  status TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  tomador_nome TEXT NOT NULL DEFAULT '',
  valor_total REAL NOT NULL DEFAULT 0,
  competencia TEXT,
  referencia TEXT,
  timeline_json TEXT NOT NULL DEFAULT '[]',
  sim_result TEXT NOT NULL,
  sim_delay_ms INTEGER NOT NULL,
  sim_source TEXT NOT NULL,
  ready_at INTEGER NOT NULL,
  process_after INTEGER,
  numero_nfse TEXT,
  serie TEXT,
  ch_nfse TEXT,
  error_code TEXT,
  error_message TEXT,
  cancel_motivo TEXT,
  cancel_codigo INTEGER,
  cancel_result TEXT,
  cancel_delay_ms INTEGER,
  cancel_source TEXT,
  cancel_error TEXT,
  issued_at INTEGER,
  cancelled_at INTEGER,
  idempotency_key TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_invoices_due ON invoices(status, process_after);
CREATE INDEX IF NOT EXISTS idx_invoices_org ON invoices(organization_id, created_at);
CREATE TABLE IF NOT EXISTS idempotency (
  id TEXT PRIMARY KEY,
  scope_id TEXT NOT NULL,
  idem_key TEXT NOT NULL,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  body_hash TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  response_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(scope_id, idem_key)
);
CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  url TEXT NOT NULL,
  events_json TEXT NOT NULL,
  secret TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id TEXT PRIMARY KEY,
  endpoint_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  invoice_id TEXT,
  event TEXT NOT NULL,
  url TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL,
  last_status_code INTEGER,
  last_error TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_deliveries_due ON webhook_deliveries(status, next_attempt_at);
CREATE TABLE IF NOT EXISTS request_logs (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  project_id TEXT,
  api_key_id TEXT,
  key_prefix TEXT,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_logs_key_time ON request_logs(api_key_id, created_at);
CREATE TABLE IF NOT EXISTS email_outbox (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  invoice_id TEXT NOT NULL,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
`;

export type DB = BetterSQLite3Database<typeof schema>;

let sqlite: Database.Database | null = null;
let orm: DB | null = null;
let openedPath: string | null = null;

export function databasePath(): string {
  return process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "estudo.sqlite");
}

export function getDb(): { db: DB; sqlite: Database.Database } {
  const file = databasePath();
  if (orm && sqlite && openedPath === file) return { db: orm, sqlite };
  if (sqlite) sqlite.close();
  mkdirSync(path.dirname(file), { recursive: true });
  sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(MIGRATION);
  orm = drizzle(sqlite, { schema });
  openedPath = file;
  return { db: orm, sqlite };
}

export function resetDb(): void {
  sqlite?.close();
  sqlite = null;
  orm = null;
  openedPath = null;
}
