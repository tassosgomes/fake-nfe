# Execução FNFE-007 — GitHub Actions (validação de PR)

- Data/hora: 2026-10-14
- Branch: `poc/postman-fake-nfe-contract` — PR [#2](https://github.com/tassosgomes/fake-nfe/pull/2)
- Experimento negativo: branch `poc/negativo-operationid` — PR [#3](https://github.com/tassosgomes/fake-nfe/pull/3) (descartável, fechado sem merge)
- Executor: Claude Code (agente), a pedido de tasso-gomes
- Postman CLI no runner: `1.74.0` (`npm install --global postman-cli@1.74.0`)
- Segredos expostos: não (`POSTMAN_API_KEY` aparece como `***` no log; artefato conferido contra chaves `ntaas_`)

## Workflow `.github/workflows/postman-validate.yml`

Dispara em `pull_request` quando mudam contrato, governança, Collections, código da API, scripts ou dependências.

| Job | Passos | Precisa do secret |
| --- | --- | --- |
| Contrato e governança | sintaxe (`--issueType syntax --fail-severity warning`) → login → governança (`--ruleset … --fail-severity error`) → lint das Collections e do environment | sim |
| Testes existentes | `npm ci` → typecheck → `npm test` | não |
| Fluxos E2E (Postman) | `npm ci` → build → bancada em background → health check → `npm run postman:e2e` → conferência de chaves → artefato (log do console + log do servidor) → encerra o grupo de processos | não |

Nenhum passo reporta ao Postman Cloud (`--no-report-events`); a publicação fica para o workflow de `main`.

## Workflow `.github/workflows/postman-publish.yml` (após merge em `main`)

Um job, só no repositório de origem, um por vez (`concurrency` sem cancelamento):

1. login com `POSTMAN_API_KEY`;
2. os mesmos gates do PR, agora com `--report-events` (lint de sintaxe e de governança, Collection de fluxos com `POSTMAN_REPORT_EVENTS=1`), mais `npm test`;
3. `postman workspace diff` como prévia e `postman workspace push --yes` com a estratégia padrão (cria e atualiza, nunca apaga);
4. se o push gravou IDs novos em `.postman/resources.yaml` (entidade criada por um PR), commita o manifest de volta em `main` como `github-actions[bot]`. Sem isso, o push seguinte criaria uma duplicata na cloud.

O contrato de origem não é alterado: o push só lê `contracts/openapi.yaml`.

Validação: `actionlint` sem avisos. A primeira execução real acontece no merge do PR #2.

## Execuções no PR #2

| Run | Commit | Contrato | Testes | E2E | Motivo |
| --- | --- | --- | --- | --- | --- |
| [38646208089](https://github.com/tassosgomes/fake-nfe/actions/runs/38646208089) | `23e5ecb` | falha | ok | falha | secret ausente; `--output` exige login |
| [38646399770](https://github.com/tassosgomes/fake-nfe/actions/runs/38646399770) | `5fcaa44` | falha → **ok** (rerun após o secret) | ok | **ok** | E2E sem `--output`; secret criado pelo usuário |

E2E no runner: 53 requests, 313 assertions, 0 falhas, 3,2 s de Collection. Job de contrato: 26 s. E2E inteiro (com `npm ci` e build): 44 s.

## Experimento negativo (gate FNFE-006)

| Passo | Commit | Resultado |
| --- | --- | --- |
| Remove `operationId` de `POST /emitir` | `6bcf7c1` | run [38646969575](https://github.com/tassosgomes/fake-nfe/actions/runs/38646969575): **Contrato e governança falha** no passo "Governança do contrato"; sintaxe e login passam; testes e E2E passam |
| Restaura o `operationId` | `65f9a71` | **nenhum workflow dispara** ("No checks reported"): o PR ficou sem diff líquido e o filtro `paths` avalia o diff do PR |
| Mudança legítima no contrato (texto do summary de `/emitir`) | `9eb5d90` | run [38648210070](https://github.com/tassosgomes/fake-nfe/actions/runs/38648210070): **os três jobs passam** (contrato 17 s, testes 20 s, E2E 1 min 3 s) |

Saída do CI no passo que falhou, igual à do lint local:

```text
│ contracts/openapi.yaml │ 78 │ paths./emitir.post │ ERROR   │ Operação sem operationId.      │ Governance │
│ contracts/openapi.yaml │ 78 │ paths./emitir.post │ WARNING │ Operação sem post.operationId. │ Governance │
✖ 2 problems (1 errors, 1 warnings, 0 infos, 0 hints)
```

O E2E passou mesmo sem o `operationId`: a Collection de fluxos não depende dele. O bloqueio vem só da governança, como deve ser.

## Achados

1. **Funções do Postman CLI que exigem login:** lint de governança (mesmo com `--ruleset` local; sem login, só `--issueType syntax`) e o relatório `--output` de `collection run`. Por isso o PR precisa do `POSTMAN_API_KEY`. PRs de fork não recebem secrets e não conseguem passar pelo job de contrato.
2. **`--output` grava as chaves completas** dos headers no YAML de execução, mesmo com a variável `type: secret`. Não serve como artefato de repositório público sem mascarar.
3. **Sem reporter JUnit/HTML** no `collection run` 1.74 (o plano previa JUnit/HTML). O artefato é o log do console.
4. **Filtro `paths` em `pull_request` avalia o diff líquido do PR.** Um PR que volta ao estado da base fica sem check. Se o check virar obrigatório (branch protection), o PR fica pendente para sempre. Alternativa para produção: job sem `paths` que decide por `dorny/paths-filter` (ou equivalente) e jobs condicionais.
5. **O token do `gh`/HTTPS não tinha escopo `workflow`**; o push de `.github/workflows/` foi feito por SSH.
6. A chave do CI é pessoal (conta do usuário). Para uso corporativo, prever conta de serviço com papel mínimo.

## Gates

FNFE-006 (pendências):

- [x] Resultado local e CI equivalentes (mesma regra, linha e mensagem).
- [x] Evidência de PR quebrada e PR corrigida.

FNFE-007:

- [x] PR inválida é bloqueada.
- [x] PR válida passa.
- [x] Segredo não aparece nos logs.
- [ ] Merge publica sem modificar o contrato de origem — workflow criado; validar na primeira execução após o merge do PR #2.
