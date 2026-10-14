# FNFE-001 — Inventário de endpoints e testes

- Data: 2026-10-14
- Commit: `ac5306e`
- Fontes: `app/api/v1/**/route.ts`, `lib/api/http.ts`, `lib/services/*`, `lib/validation.ts`, `docs/*.md`, `tests/*.test.ts`

## 1. Comportamento comum a todas as rotas

| Aspecto | Comportamento real |
| --- | --- |
| Base | `/api/v1` |
| Autenticação | Header `x-api-key`. Chave de projeto `ntaas_*` ou token de organização `ntaas_org_*` |
| Headers fixos de resposta | `X-Ambiente: estudo`, `X-Aviso: sem-valor-fiscal` |
| Formato de erro | `application/json` com `{ type: "erro_de_estudo", code, message, campo, aviso }` |
| Rate limit | Por chave, padrão 60/min (projeto) e 120/min (org), configurável de 1 a 600. Responde `429` com `Retry-After: 60` |
| Idempotência | `Idempotency-Key` (`[A-Za-z0-9_-]{1,80}`) em `emitir` e `cancelar`. Replay devolve `Idempotent-Replayed: true`. Corpo diferente devolve `409 idempotency_conflito` |
| Corpo | JSON. Corpo inválido devolve `400 json_invalido`. Upload usa `multipart/form-data` |
| Erro inesperado | `500 erro_interno` |
| Correlation ID | **Não existe** |
| Health check | **Não existe** (`/api/health` e `/api/v1/health` devolvem 404 HTML) |

### Erros de autenticação

| Situação | Rota de projeto | Rota de organização |
| --- | --- | --- |
| Sem header | `401 nao_autorizado` | `403 tipo_de_chave` |
| Tipo de chave errado | `403 tipo_de_chave` | `403 tipo_de_chave` |
| Chave desconhecida | `401 nao_autorizado` | `401 nao_autorizado` |
| Chave revogada | `403 chave_revogada` | `403 chave_revogada` |
| Sem escopo | `403 escopo` | `403 escopo` |

Escopos de projeto: `emit`, `cancel`, `query`, `webhooks`. Escopos de organização: `projects:read`, `projects:write`, `api_keys:manage`, `settings:read`, `settings:write`, `certificates:write`.

## 2. Matriz endpoint → código → teste

Legenda da superfície: **P** = pública para o integrador (chave de projeto), **A** = administrativa (token de organização).

| # | Método e caminho | Sup. | Escopo | Sucesso | Erros específicos | Teste existente |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `POST /emitir` | P | `emit` | `202` `{ queued, invoiceId, status, pollUrl, cenario, origemCenario, atrasoMs, aviso }` | `400 payload_invalido`, `400 simulacao_invalida`, `403 cota_esgotada`, `422 empresa_inativa`, `409 idempotency_conflito` | `flow.test.ts`: emissão, rejeição, idempotência, chave inválida e cota |
| 2 | `GET /invoices/{id}/status` | P | `query` | `200` invoice pública (status, número, URLs de documentos, erro, cancelamento) | `404 nao_encontrado` | `flow.test.ts` (emissão, cancelamento) |
| 3 | `GET /invoices/{id}/xml[?type=cancel]` | P | `query` | `200 application/xml; charset=utf-8`, `attachment` | `404`, `409 documento_indisponivel` | `flow.test.ts` + `pure.test.ts` (leiaute) |
| 4 | `GET /invoices/{id}/pdf` | P | `query` | `200 application/pdf`, `inline` | `404`, `409 documento_indisponivel` | `flow.test.ts` |
| 5 | `POST /cancelar` | P | `cancel` | `202` `{ queued, invoiceId, status: cancel_queued, cenario, atrasoMs, aviso }` | `400 payload_invalido`, `404`, `422 status_invalido`, `422 motivo_invalido` (15–255), `409 idempotency_conflito` | `flow.test.ts` (aceito e recusado) |
| 6 | `GET /webhooks/endpoints` | P | `webhooks` | `200 { data: [...] }` | — | não |
| 7 | `POST /webhooks/endpoints` | P | `webhooks` | `201` endpoint + `secret` | `400 payload_invalido`, `400 url_invalida`, `400 evento_invalido` | `flow.test.ts` (webhook assinado) |
| 8 | `PATCH /webhooks/endpoints/{id}` | P | `webhooks` | `200` endpoint | `400`, `404` | não |
| 9 | `DELETE /webhooks/endpoints/{id}` | P | `webhooks` | `200 { deleted: true }` | `404` | não |
| 10 | `POST /webhooks/endpoints/{id}/test` | P | `webhooks` | `202` entrega enfileirada | `404`, `422 evento_ausente` | não |
| 11 | `GET /webhooks/deliveries?limit=` | P | `webhooks` | `200 { data: [...] }` (limite máx. 100) | — | não |
| 12 | `GET /org/projects?active=&page=&limit=` | A | `projects:read` | `200 { data, pagination }` | — | não |
| 13 | `POST /org/projects` | A | `projects:write` | `201` projeto | `400 payload_invalido`, `400 cnpj_invalido`, `403 limite_de_empresas` (5), `409 cnpj_duplicado` | não (só o serviço) |
| 14 | `GET /org/projects/{id}` | A | `projects:read` | `200` projeto | `404` | não |
| 15 | `PATCH /org/projects/{id}` | A | `projects:write` | `200 { updated, id, project }` | `400`, `404` | não |
| 16 | `DELETE /org/projects/{id}` | A | `projects:write` | `204` (desativa e revoga chaves) | `404` | não |
| 17 | `GET /org/projects/{id}/numeracao` | A | `projects:read` | `200 { nfse: { ultimoNumero, proximoNumero, serie } }` | `404` | não (serviço em `flow.test.ts`) |
| 18 | `PATCH /org/projects/{id}/numeracao` | A | `projects:write` | `200` (número menor é ignorado) | `400`, `404` | não (serviço em `flow.test.ts`) |
| 19 | `GET /org/projects/{id}/api-keys` | A | `api_keys:manage` | `200 { data: [...] }` | `404` | não |
| 20 | `POST /org/projects/{id}/api-keys` | A | `api_keys:manage` | `201` chave + `key` (exibida uma vez) | `400 payload_invalido`, `400 limite_invalido`, `404` | não |
| 21 | `DELETE /org/projects/{id}/api-keys/{keyId}` | A | `api_keys:manage` | `200 { revoked, id }` | `404` | não |
| 22 | `POST /org/projects/{id}/certificate` | A | `certificates:write` | `201` metadado (multipart `file`, `password`) | `400 arquivo_invalido`, `400 senha_ausente`, `413 arquivo_grande` (50 KB), `404` | não |
| 23 | `POST /org/projects/{id}/logo` | A | `projects:write` | `201` (multipart `file`, PNG/JPEG/WebP) | `400 logo_invalida`, `413 logo_grande` (500 KB), `404` | não |
| 24 | `DELETE /org/projects/{id}/logo` | A | `projects:write` | `200 { ok }` | `404` | não |
| 25 | `GET /org/settings` | A | `settings:read` | `200` plano, créditos, simulação, domínio | — | não |
| 26 | `PATCH /org/settings` | A | `settings:write` | `200` (domínio https, verificação simulada) | `400 payload_invalido`, `400 url_invalida`, `422 sem_dominio` | não |

**Cobertura atual por teste:** 8 das 26 operações (31%), todas sem HTTP real.

## 3. Fluxos de negócio

### Ciclo de vida da nota

```text
emitir ─202─▶ queued ─▶ processing ─▶ issued ──cancelar─202─▶ cancel_queued ─▶ cancelled
                                   └─▶ error (E001..E004)              └─ recusa ─▶ issued (+cancelamentoRecusado)
```

- A transição é assíncrona: o varredor da fila (`lib/simulation/sweeper.ts`) roda no processo do servidor.
- O resultado pode ser forçado com `simulacao: { resultado, atrasoMs }` no corpo ou `X-Simulacao: resultado:ms` no header. O corpo vence o header.
- XML e PDF só ficam disponíveis com `issued` ou `cancelled`. O XML de cancelamento só existe com `cancelled`.

### Webhooks (saída)

- Eventos: `nfse.issued`, `nfse.error`, `nfse.cancelled`, `nfse.documents_ready`.
- POST com `X-Notaas-Event`, `X-Notaas-Delivery` e `X-Notaas-Signature: sha256=<HMAC do corpo cru>` quando há segredo.
- Uma tentativa imediata e mais 3 retentativas (10 s, 30 s, 60 s por padrão).
- A bancada **envia** webhooks e não recebe nenhum. O cenário negativo "webhook com assinatura inválida" do plano não se aplica como request à API; vira teste de um receptor local.

### Onboarding

- Conta, organização e **token de organização** só podem ser criados pelo painel (`/cadastro`, `/painel/chaves`), via server actions com cookie de sessão.
- Com o token de organização, a API cria empresa e chave de projeto (rotas 13 e 20).

## 4. Divergências e lacunas

| ID | Lacuna | Impacto na POC | Proposta |
| --- | --- | --- | --- |
| G-01 | Sem endpoint de health | Passo 1 do E2E e health check do CI | Adicionar `GET /api/v1/health` sem auth (mudança de código, pede aprovação) |
| G-02 | Sem bootstrap por API: o token de organização só nasce no painel | A Collection não consegue montar o ambiente sozinha; o CI precisa de seed | Script `npm run seed:poc` que usa os serviços (como os testes) e grava as chaves num arquivo local ignorado pelo Git |
| G-03 | Erros não seguem `application/problem+json` | Regra de governança "erro documentado" e assertion de Problem Details | Documentar o formato atual no contrato como `ErroDeEstudo` e registrar como gap, sem mudar o código agora |
| G-04 | Sem correlation ID | Regra WARN de correlation ID e assertion da Collection | Registrar como gap; decidir se a POC adiciona `X-Correlation-Id` |
| G-05 | Rota de organização sem header devolve `403`, não `401` | Contrato precisa documentar o real; inconsistência com as rotas de projeto | Documentar o real e registrar como gap |
| G-06 | Cota de 50 notas por organização e 5 empresas | 10 execuções E2E com negativos esgotam a cota de uma org | Seed cria organização nova por execução, ou banco descartável no CI |
| G-07 | Rate limit padrão de 60/min por chave | Execuções seguidas podem receber `429` | Seed cria a chave com limite maior (até 600) |
| G-08 | Resultado aleatório (15% de falha) e atraso de 2 a 6 s por padrão | Flakiness no E2E | Collection sempre força `simulacao: { resultado: "sucesso", atrasoMs: 0 }` no fluxo feliz e polling com timeout |
| G-09 | Não há listagem de notas pela API (só no painel) | Sem cleanup por API; consulta só por `invoiceId` | Cleanup = banco descartável. Registrar como fora de escopo |
| G-10 | Nenhum teste HTTP real; 18 de 26 operações sem teste | — | A Collection preenche essa lacuna |
| G-11 | Sem OpenAPI, sem CI | — | FNFE-002 e FNFE-007 |
| G-12 | Docs não documentam o status das rotas administrativas nem os erros por rota | — | O contrato passa a ser a referência |

## 5. Escopo proposto para o contrato (FNFE-002)

- Tag **Notas** (P): rotas 1–5.
- Tag **Webhooks** (P): rotas 6–11, mais `webhooks:` do OpenAPI 3.1 para os 4 eventos de saída.
- Tag **Administração** (A): rotas 12–26, com `security` separado (`orgToken`).
- Partner Workspace (FNFE-009) expõe só **Notas** e **Webhooks**.

## 6. Gate FNFE-001

- [x] Build e testes executados (ver `POC-002-baseline.md`).
- [x] Todas as 26 operações classificadas (P/A, escopo, status, teste).
- [x] Divergências entre documentação e código registradas (G-03, G-05, G-12).

## 7. Lacunas resolvidas após o inventário

Mudanças aprovadas em 2026-10-14 e feitas na branch `poc/postman-fake-nfe-contract`.

| ID | Resolução | Verificação |
| --- | --- | --- |
| G-01 | `GET /api/v1/health`, público, sem rate limit nem log de acesso; checa o SQLite e responde `503 banco_indisponivel` se falhar | teste `health responde sem chave` + smoke com `next start` |
| G-02 | `npm run seed:poc` cria conta, organização, empresa (CNPJ sintético) e chaves com 600/min, e grava um environment Postman em `data/` (ignorado pelo Git, modo 600). O console mostra só prefixos | smoke: seed → emissão → `issued` → PDF `200` |
| G-03 | Erros em `application/problem+json` (RFC 9457) com `type` `urn:bancada-nfse:problema:<code>`, `title`, `status`, `detail`, `instance` e extensões `code`, `campo`, `correlationId`, `aviso`. O `429` também segue o formato e mantém `Retry-After` | teste `erro segue problem+json…` + smoke |
| G-04 | `X-Correlation-Id` em todas as respostas da API. Valor recebido é ecoado se casar com `[A-Za-z0-9._:-]{1,128}`; senão a bancada gera um UUID | testes de correlation + smoke |
| G-06, G-07 | Resolvidas pelo seed (organização nova por execução, limite de 600/min) | — |

**Mudança incompatível:** o corpo de erro trocou `type: "erro_de_estudo"` e `message` por `type` URN e `detail`. Nenhum consumidor interno usava esses campos: o painel usa server actions e os testes só verificavam status.

**Continuam em aberto:** G-05 (rota de organização sem header devolve `403`), G-08 (a Collection precisa forçar o cenário), G-09 (sem listagem de notas pela API) e G-12 (vira responsabilidade do contrato).

Testes depois das mudanças: 15 de 15 passando, typecheck ok, build ok.
