# Execução FNFE-006 — Governança (parte local)

- Data/hora: 2026-10-14
- Branch: `poc/postman-fake-nfe-contract`
- Executor: Claude Code (agente), a pedido de tasso-gomes
- Postman CLI: `1.74.0`
- Comando sanitizado: `npm run lint:contract` (`postman spec lint contracts/openapi.yaml --ruleset governance/openapi.spectral.yaml --fail-severity error --no-report-events`)
- Segredos expostos: não

A parte "PR quebrada / PR corrigida" depende do CI e fica na FNFE-007.

## Ruleset

`governance/openapi.spectral.yaml` parte do ruleset corporativo `tsg-flow-contract-creator/rulesets/openapi.yaml` (`code-for-coders` @ `bcb543e`) e acrescenta as regras do plano.

| Regra | Severidade | Origem | Aceita exceção |
| --- | --- | --- | --- |
| `tsg-openapi-version` | error | corporativa | não |
| `tsg-no-deprecated-schema-example` | error | corporativa | não |
| `tsg-schema-examples-array` | error | corporativa | não |
| `tsg-paths-kebab-case` | error | corporativa | não |
| `tsg-paths-max-nesting` | warn | corporativa | não |
| `tsg-api-must-be-versioned` | error | corporativa | não |
| `tsg-content-type-json-only` | error | corporativa | **sim** |
| `tsg-operation-security-defined` | error | corporativa | não |
| `tsg-operation-has-success-response` | error | corporativa | não |
| `tsg-error-uses-problem-details` | error | corporativa | não |
| `tsg-problem-details-schema` | warn | corporativa | não |
| `tsg-collection-pagination-params` | warn | corporativa | **sim** |
| `tsg-info-contact-defined` | **error** (era warn) | corporativa | não |
| `tsg-operation-must-be-documented` | warn | corporativa | não |
| `fnfe-operation-id-required` | error | plano | não |
| `fnfe-error-response-documented` | error | plano | não |
| `fnfe-operation-tags` | warn | plano | não |
| `fnfe-request-body-examples` | warn | plano | não |
| `fnfe-correlation-id-documented` | warn | plano | não |
| `fnfe-exception-allowed-rule` | error | POC | — |
| `fnfe-exception-has-reason` | error | POC | — |

Unicidade de `operationId` (pedida no plano) não tem função Spectral nativa e o Postman não aceita funções customizadas nem `extends: spectral:oas`, onde ela mora. Fica coberta pela checagem estrutural do próprio CLI — a confirmar com uma mutação na FNFE-007.

### Exceções no contrato

Sem `overrides`, as exceções ficam no próprio contrato, visíveis no PR:

```yaml
x-governanca-excecoes:
  tsg-content-type-json-only: O DANFSe de estudo é PDF binário; erros continuam em problem+json.
```

10 exceções registradas: 4 de content type (XML, PDF, upload de certificado e de logo) e 6 de paginação (2 falsos positivos da regra corporativa, que trata `status` e `settings` como coleções por terminarem em "s"; 4 coleções que não usam `_page`/`_size`).

## Primeira rodada contra o contrato da FNFE-002

| Achado | Qtd. | Tratamento |
| --- | ---: | --- |
| Operação sem `security` explícito (herdava da raiz) | 11 ERROR | contrato corrigido |
| Content type não JSON | 4 ERROR | exceção documentada |
| Operação sem `description` | 7 WARN | contrato corrigido |
| Paginação fora de `_page`/`_size` | 6 WARN | exceção documentada |
| Health sem resposta 4xx | 1 ERROR | regra ajustada para "4xx ou 5xx", como o plano descreve |
| Corpo de requisição sem exemplo | 3 WARN | contrato corrigido |

Depois das correções: **0 violações, exit 0.**

## Mutações (cada regra precisa pegar o problema)

Cópias do contrato alteradas com `yq`, fora do repositório:

| Mutação | Exit | Violação |
| --- | ---: | --- |
| remover `operationId` de `/emitir` | 1 | ERROR `Operação sem operationId.` + WARN de documentação |
| remover `info.contact` | 1 | ERROR `Preencha info.contact…` |
| remover `security` de `/emitir` | 1 | ERROR `Declare security na operação…` |
| exceção para `tsg-operation-security-defined` | 1 | ERROR `A regra … não aceita exceção.` |
| exceção com motivo curto | 1 | ERROR `Exceção sem motivo suficiente.` |
| PDF sem exceção | 1 | ERROR `Content type fora do padrão JSON…` |
| erro 400 em `application/json` | 1 | ERROR `Resposta de erro sem application/problem+json.` |
| path `/emitirNota` | 1 | ERROR `Path fora do padrão kebab-case.` |
| `/emitir` sem nenhuma resposta de erro | 1 | ERROR `…nenhuma resposta de erro (4xx ou 5xx).` |
| `/emitir` sem `X-Correlation-Id` | **0** | WARN `Operação sem o parâmetro X-Correlation-Id.` (warn não bloqueia, como planejado) |
| `servers` sem `/vN` | 1 | ERROR `Contrato sem versão…` |

Toda saída indica arquivo, linha, caminho JSON, severidade e mensagem.

## Achados sobre o Postman

1. **Rulesets do Postman não aceitam `extends`** — nem `spectral:oas`, nem arquivo local. Erro: `"extends" isn't supported in Postman rulesets`.
2. **Nem `overrides`.** Exceções por arquivo/caminho, como o `.spectral-exception.yaml` do `code-for-coders`, não funcionam.
3. Consequência: **reaproveitar o ruleset corporativo no CLI exige copiar e adaptar**. A forma nativa de compartilhar regras no Postman são os Governance Groups na cloud (ENT-001), que não leem o ruleset do Git.
4. **`--ruleset` substitui as regras do time, não soma.** Sem ele, o lint aplica a regra do time `OPENAPI_SPECTRAL_6_RULE_1027` (23 warnings); com ele, só as do arquivo.
5. **`{{value}}` nas mensagens vira `[object Object]`.** `{{property}}` funciona.
6. **Filtros JSONPath com `@property` e acesso a extensões `x-` funcionam**, o que permitiu as exceções declaradas no contrato.
7. **`postman spec sync collection` sorteia de novo os valores de exemplo a cada execução.** Uma mudança de 37 linhas no contrato gerou 132 arquivos alterados na Collection de referência. Impede um check de "Collection em dia" no CI e polui o PR. Mitigação: exemplos explícitos no contrato.
8. O sync acrescentou `auth` explícito nas 11 operações que passaram a declarar `security`.

## Pendências para o ENT-001 (Governance Groups)

- Ver se um Governance Group consegue aplicar este ruleset ao workspace, e se aceita `extends`/`overrides` na cloud.
- Decidir o destino da regra do time `OPENAPI_SPECTRAL_6_RULE_1027` (restringir a schemas de objeto ou rebaixar).
- Comparar o resultado do lint local com o do Spec Hub para o mesmo commit.

## Gate FNFE-006

- [x] Regras do plano implementadas com a severidade pedida (unicidade de `operationId` a confirmar na FNFE-007).
- [x] Mensagem identifica arquivo, regra e severidade.
- [x] Falha reproduzida localmente (remoção de `operationId`) e contrato corrigido passando.
- [ ] Resultado local e CI equivalentes — FNFE-007.
- [ ] Evidência de PR quebrada e PR corrigida — FNFE-007.
