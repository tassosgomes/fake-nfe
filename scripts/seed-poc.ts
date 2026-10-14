// Prepara uma organização descartável para a Collection Postman e o CI.
// Cada execução cria conta, organização, empresa e chaves novas, então a cota de
// 50 notas e o limite de 5 CNPJs nunca vazam de uma rodada para outra.
//
// As chaves vão só para o arquivo de saída (padrão em data/, ignorado pelo Git).
// O console mostra apenas os prefixos.
import { randomBytes, randomInt } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { databasePath } from "../lib/db/client";
import { registerAccount } from "../lib/services/accounts";
import { createApiKey } from "../lib/services/keys";
import { createProject } from "../lib/services/projects";

const RATE_LIMIT = 600;

function cnpjDigit(base: string, factors: number[]): number {
  const sum = base.split("").reduce((acc, digit, index) => acc + Number(digit) * factors[index], 0);
  const mod = sum % 11;
  return mod < 2 ? 0 : 11 - mod;
}

function syntheticCnpj(): string {
  const base = Array.from({ length: 8 }, () => randomInt(10)).join("") + "0001";
  const first = cnpjDigit(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = cnpjDigit(base + first, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return `${base}${first}${second}`;
}

function variable(key: string, value: string, secret = false) {
  return { key, value, type: secret ? "secret" : "default", enabled: true };
}

const baseUrl = process.env.SEED_BASE_URL ?? "http://localhost:3000/api/v1";
const output = path.resolve(process.env.SEED_OUTPUT ?? path.join("data", "poc.postman_environment.json"));
const stamp = `${Date.now().toString(36)}${randomBytes(2).toString("hex")}`;

const account = registerAccount({
  name: "POC Postman",
  email: `poc-${stamp}@bancada.test`,
  password: randomBytes(18).toString("base64url"),
  organizationName: `POC Postman ${stamp}`,
});
const project = createProject(account.orgId, {
  name: `Empresa POC ${stamp}`,
  cnpj: syntheticCnpj(),
  razaoSocial: "Empresa de Estudo POC LTDA",
});
const orgKey = createApiKey({
  organizationId: account.orgId,
  kind: "org",
  name: `poc-org-${stamp}`,
  rateLimitPerMinute: RATE_LIMIT,
});
const projectKey = createApiKey({
  organizationId: account.orgId,
  projectId: project.id,
  kind: "project",
  name: `poc-projeto-${stamp}`,
  rateLimitPerMinute: RATE_LIMIT,
});

mkdirSync(path.dirname(output), { recursive: true });
writeFileSync(
  output,
  JSON.stringify(
    {
      name: `fake-nfe local (seed ${stamp})`,
      values: [
        variable("baseUrl", baseUrl),
        variable("organizationId", account.orgId),
        variable("projectId", project.id),
        variable("projectCnpj", project.cnpj),
        variable("apiKey", projectKey.key, true),
        variable("orgToken", orgKey.key, true),
      ],
      _postman_variable_scope: "environment",
    },
    null,
    2,
  ) + "\n",
  { mode: 0o600 },
);

console.log(`Seed POC pronto no banco ${databasePath()}`);
console.log(`  organização ${account.orgId}`);
console.log(`  empresa     ${project.id}`);
console.log(`  chave       ${projectKey.keyPrefix}… (projeto, ${RATE_LIMIT}/min)`);
console.log(`  token       ${orgKey.keyPrefix}… (organização, ${RATE_LIMIT}/min)`);
console.log(`  environment ${path.relative(process.cwd(), output)}`);
