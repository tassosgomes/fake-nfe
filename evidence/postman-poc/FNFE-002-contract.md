# Execução FNFE-002 — Contrato OpenAPI autoritativo

- Data/hora: 2026-10-14
- Repositório/commit: `tassosgomes/fake-nfe`, contrato em `contracts/openapi.yaml`
- Branch: `poc/postman-fake-nfe-contract`
- Executor: Claude Code (agente), a pedido de tasso-gomes
- Postman CLI: `1.74.0`
- Comando sanitizado: `postman spec lint contracts/openapi.yaml --no-report-events -o json`
- Segredos expostos: não

## Conteúdo

| Item | Valor |
| --- | --- |
| Versão | OpenAPI 3.1.0 |
| Caminhos / operações | 18 / 27 (health + as 26 do inventário FNFE-001) |
| `operationId` | 27, todos únicos |
| Webhooks de saída | 4 (`nfse.issued`, `nfse.documents_ready`, `nfse.error`, `nfse.cancelled`) |
| Schemas reutilizáveis | 53 |
| Tags | Saúde, Notas e Webhooks (públicas, chave de projeto), Administração (interna, token de organização) |
| Erros | `application/problem+json`, 11 respostas reutilizáveis |
| Headers documentados | `X-Correlation-Id`, `X-Ambiente`, `X-Aviso`, `Idempotent-Replayed`, `Retry-After`, `Content-Disposition` |
| Exemplos | Sintéticos. CNPJs de teste (`19131243000197`, `11222333000181`), domínios `.test` |

Toda decisão de schema saiu do código (`lib/validation.ts`, `lib/services/*`, rotas). Nenhum comportamento foi inventado; onde a API aceita campos livres (`tomador`, `servico`, `valores`), o contrato diz `additionalProperties: true`.

## Lint

| Rodada | Erros | Warnings | Exit |
| --- | ---: | ---: | ---: |
| Primeira versão | 0 | 43 | 0 |
| Depois de extrair 20 corpos inline para componentes | 0 | 23 | 0 |
| Mesmo contrato com `--fail-severity warning` | — | — | 1 |

Os 23 warnings restantes são todos da mesma regra de governança, `A schema property should have a $ref property referencing a reusable schema`, aplicada a schemas primitivos: `type: string` de parâmetros e headers (inclusive dentro de `components.parameters` e `components.headers`) e os binários de XML e PDF. Extrair isso para `$ref` só acrescenta indireção. **Insumo para a FNFE-006:** restringir essa regra a schemas de objeto, ou rebaixar para `INFO`.

## Achados sobre o Postman CLI

1. **`spec lint` envia eventos ao API Catalog por padrão.** `--report-events` vem ligado; para não reportar é preciso `--no-report-events`. O plano supunha o contrário. No CI de PR, decidir explicitamente.
2. **O lint aplicou uma regra de governança sem `--ruleset` nem `--workspace-id`.** Origem provável: as regras padrão do time ECAD. Confirmar na FNFE-006 qual ruleset está ativo e quem administra.
3. **`postman init` só descobre specs em diretórios convencionais.** Testado num clone descartável:

   | Local do arquivo | Descoberto |
   | --- | --- |
   | `openapi.yaml` (raiz) | sim |
   | `specs/`, `spec/`, `api/`, `openapi/`, `postman/specs/` | sim |
   | `contracts/`, `docs/` | **não** |

   `postman init --spec contracts/openapi.yaml` falha com exit 4 (`spec-hint-unmatched`), mesmo com o arquivo commitado.
4. **Um manifest escrito à mão resolve.** Com `.postman/resources.yaml` contendo `localResources.specs: [../contracts/openapi.yaml]`, o `init --dry-run` adota o contrato com `source: existing-config`. Isso mantém `contracts/` como fonte da verdade e é a hipótese a validar no `code-for-coders` (CFC-003). Ainda falta provar que `workspace push` sincroniza um spec fora dos diretórios convencionais.
5. **`--no-cloud` não existe na 1.74**, apesar de a skill de bootstrap citar. Sem TTY e sem `--visibility`, o `init` escreve só os arquivos locais e não cria workspace.
6. **`--no-fetch` muda o que é instalado:** sem fetch, só a skill `api-builder` (bundled); com fetch, 17 skills em `postman/skills/`.

## Plano do `init` (dry-run, sem gravar nada)

O `init` vai criar, sem sobrescrever nada existente:

- `.postman/resources.yaml` e `.postman/skills.json`;
- `AGENTS.md` na raiz (o repositório não tem um);
- `postman/{collections,environments,flows,globals,sdks,specs,skills}`.

Nenhum conflito com arquivos do repositório.

## Gate FNFE-002

- [x] Contrato passa no lint estrutural (0 erros).
- [x] Todas as rotas do escopo mapeadas (27 operações + 4 webhooks).
- [x] Diferenças que pediam mudança de código foram feitas antes (G-01 a G-05) ou registradas (G-08, G-09).
- [x] Sem segredos nem dados reais.
- [ ] Aderência ao comportamento real verificada por execução: fica para a FNFE-004, com validação de schema nas respostas da Collection.
