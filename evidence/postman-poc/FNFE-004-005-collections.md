# Execução FNFE-004 / FNFE-005 — Collections e fluxo E2E

- Data/hora: 2026-10-14
- Branch: `poc/postman-fake-nfe-contract`
- Executor: Claude Code (agente), a pedido de tasso-gomes
- Postman CLI: `1.74.0`
- Ambiente: `next start` (build de produção) com SQLite temporário, organização nova por execução (`npm run seed:poc`)
- Comando sanitizado: `npm run postman:e2e` (`postman collection run "postman/collections/Bancada NFS-e Fluxos" -e <env de data/> --env-var contractSchemas=<components.schemas> --no-report-events`)
- Segredos expostos: não

## Duas Collections, papéis diferentes

| Collection | Origem | Papel |
| --- | --- | --- |
| `Bancada NFS-e API` | `postman spec generate collection contracts/openapi.yaml --folder-strategy Tags`, ligada ao spec em `.postman/workflows.yaml` | Referência das 27 operações, documentação e base de mock. Regenerada com `postman spec sync`; não se edita à mão |
| `Bancada NFS-e Fluxos` | Escrita para a POC, organizada por intenção de negócio | Testes funcionais e E2E com assertions de contrato e de domínio |

### Por que a gerada não serve para testar

1. **Exemplos sintéticos ignoram `const`.** O exemplo do `202` de emissão traz `"queued": false` e `"status": "string"`, contradizendo o contrato. Um mock baseado neles mente (pesa na FNFE-009).
2. **Os dois esquemas de segurança viram a mesma variável `{{apiKey}}`.** As 15 rotas de Administração mandariam a chave de projeto e receberiam `403`.
3. **Valores de exemplo dos headers ficam ligados**, como `Idempotency-Key: emissao-os-1`: execuções repetidas viram replay.
4. **O nome de cada exemplo é a `description` da resposta**, truncada. Descrições longas geram nomes de arquivo com crases e cortes.

## Collection de fluxos

10 pastas, 50 requests:

| Pasta | Requests | O que prova |
| --- | ---: | --- |
| 00 - Saúde e setup | 2 | health sem chave; linha de base da cota |
| 01 - Empresas | 7 | cadastro com CNPJ sintético válido, leitura, atualização, numeração que nunca recua |
| 02 - Chaves | 4 | chave completa só na criação, listagem sem segredo, revogação efetiva (`403 chave_revogada`) |
| 03 - Emissão | 2 | `202` sem autorização imediata; replay idempotente com `Idempotent-Replayed` |
| 04 - Consulta | 1 | polling até `issued` com número, `ESTUDO-` e documentos |
| 05 - Documentos | 3 | XML e PDF com tipo, disposição e conteúdo; XML de cancelamento ainda indisponível (`409`) |
| 06 - Cancelamento | 4 | cancelamento até `cancelled`, XML de cancelamento, recancelar recusado (`422`) |
| 07 - Webhooks | 7 | segredo só na criação, evento de teste no histórico, desativar, remover, `404` depois |
| 90 - Cenários negativos | 17 | autenticação (4), validação (4), idempotência, inexistente, rejeição municipal até `error/E001`, documento antes da emissão, cancelar nota rejeitada, URL de webhook, correlation ID inválido |
| 99 - Cleanup | 3 | empresa desativada sai da listagem; **a cota sobe exatamente 1** (replay e rejeição não consomem) |

### Assertions comuns (script da coleção, todo request)

- status esperado, declarado pelo request em `expect`;
- `X-Ambiente: estudo`;
- `X-Correlation-Id` ecoado quando válido, UUID quando inválido;
- tempo de resposta indicativo abaixo de 3 s;
- em erro: `application/problem+json`, `type` = `urn:bancada-nfse:problema:<code>`, `status`, `instance`, `correlationId` igual ao header, `title` e `detail`, mais `code` e `campo` esperados;
- **corpo validado contra o schema do contrato** (`pm.response.to.have.jsonSchema` com `components.schemas` injetado na execução).

O contrato não é copiado para a Collection: `scripts/postman-e2e.sh` lê `contracts/openapi.yaml` com `yq` e passa os schemas por `--env-var`. Rodando a Collection de outro jeito (ex.: no app), as validações de schema aparecem como puladas.

### Isolamento e determinismo

- Organização, empresa e chaves novas por execução (seed), então cota, limite de empresas e rate limit não vazam entre execuções.
- Cenário sempre forçado (`simulacao.resultado`, `atrasoMs: 0`).
- Polling com `pm.execution.setNextRequest`, 500 ms entre consultas, máximo de 30.
- IDs e dados encadeados em variáveis da execução; a chave temporária fica só em `pm.variables` (não persiste).

## Resultados

### Execução de referência

52 requests, 308 assertions, 0 falhas, 0 puladas, 3,6 s.

### Teste de mutação

Contrato alterado só na memória (`Nota.required += campoInexistente`): **6 falhas**, uma por consulta de nota, exit 1. Mensagem:

```text
corpo segue o schema Nota do contrato
expected data to satisfy schema but found following errors:
data should have required property 'campoInexistente'
inside "04 - Consulta / Consultar até emitida"
```

### Estabilidade (gate FNFE-005): 10 execuções seguidas

| # | Exit | Duração (com seed) | Requests | Assertions | Falhas |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 0 | 7,5 s | 53 | 313 | 0 |
| 2 | 0 | 6,7 s | 52 | 308 | 0 |
| 3 | 0 | 6,0 s | 51 | 303 | 0 |
| 4 | 0 | 7,1 s | 53 | 313 | 0 |
| 5 | 0 | 4,9 s | 53 | 313 | 0 |
| 6 | 0 | 6,4 s | 52 | 308 | 0 |
| 7 | 0 | 6,3 s | 52 | 308 | 0 |
| 8 | 0 | 7,0 s | 53 | 313 | 0 |
| 9 | 0 | 6,6 s | 52 | 308 | 0 |
| 10 | 0 | 4,7 s | 53 | 313 | 0 |

A variação de requests e assertions vem só da quantidade de consultas no polling.

## Achados sobre o Postman CLI

1. **Scripts no `definition.yaml` usam `http:beforeRequest`/`http:afterResponse`; nos requests, `beforeRequest`/`afterResponse`.** Com o tipo errado no definition, `collection lint` passa e `collection run` falha com `Invalid input for model`, sem dizer o arquivo.
2. **`auth.credentials` é um mapa** (`key`, `value`, `in`) no formato que o próprio gerador escreve; a skill descreve uma lista.
3. **`collection lint` exige que `queryParams` e a query da URL sejam idênticos** (`FMT209`).
4. **`collection run` aceita environment v2 em JSON** (o arquivo do seed) com a Collection v3.
5. **`collection run` também reporta ao API Catalog por padrão**; o script usa `--no-report-events` salvo com `POSTMAN_REPORT_EVENTS=1`.
6. **`workspace lint` passou a buscar as regras de governança depois do primeiro push.** A regra dos 23 warnings do contrato é `OPENAPI_SPECTRAL_6_RULE_1027`.

## Cobertura

- Collection de fluxos: 26 das 27 operações. Faltam upload de certificado e de logo (multipart), cobertos só pela Collection de referência.
- Antes da POC: 8 operações testadas, nenhuma via HTTP.

## Gates

FNFE-004:

- [x] Collection executa por arquivo local.
- [x] Nenhum valor sensível versionado (`Local.environment.yaml` só com `baseUrl`; credenciais vazias como `secret`).
- [x] Requests organizados por intenção de negócio.
- [x] Aderência contrato × comportamento real verificada por execução (pendência da FNFE-002).

FNFE-005:

- [x] Fluxo passa localmente 10 vezes sem flakiness.
- [x] Falha deixa diagnóstico útil (teste de mutação).
- [x] Dados isolados por execução.
