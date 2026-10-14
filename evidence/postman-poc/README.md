# Evidências — POC Postman Enterprise (`fake-nfe`)

Registros reproduzíveis da POC descrita no pacote de planejamento `postman-ee/docs`. Cada arquivo corresponde a uma task (`POC-*`, `FNFE-*`).

| Arquivo | Task | Estado |
| --- | --- | --- |
| [`POC-002-baseline.md`](POC-002-baseline.md) | POC-002 / POC-004 — baseline e versão do CLI | concluída |
| [`FNFE-001-inventory.md`](FNFE-001-inventory.md) | FNFE-001 — inventário de endpoints e testes | concluída |
| [`FNFE-002-contract.md`](FNFE-002-contract.md) | FNFE-002 — contrato OpenAPI e dry-run do `init` | concluída (aderência por execução na FNFE-004) |
| [`FNFE-003-native-git.md`](FNFE-003-native-git.md) | FNFE-003 — bootstrap Native Git e primeiro push | concluída |
| [`FNFE-004-005-collections.md`](FNFE-004-005-collections.md) | FNFE-004 / FNFE-005 — Collections e E2E (10 execuções) | concluída |

## Regras

- Nunca registrar chaves `ntaas_*`, `POSTMAN_API_KEY`, cookies de sessão, URLs assinadas ou IDs de workspace privados.
- Usar só dados sintéticos. Os CNPJs dos exemplos são números de teste com dígito válido.
- Screenshots só depois de conferir que não mostram token, e-mail real ou ID sensível.
- Comandos aparecem sanitizados: segredo vira `<REDACTED>`.

## Checklist de segurança (POC-003)

- [x] `.gitignore` cobre `data/`, `*.sqlite*` e `.next`.
- [x] Nenhum segredo no repositório na data do baseline.
- [x] Environment Postman versionado só com `baseUrl` e variáveis sem valor.
- [x] `apiKey` e `orgToken` só em arquivo local ignorado (`data/`); no CI, gerados pelo seed a cada execução.
- [ ] Secret Scanner do Postman habilitado no workspace (depende do tenant).
- [ ] Inventário do que vai para a cloud do Postman: contrato, Collection, resultados de lint e de run. Nenhum payload real.

## Template de execução

```markdown
# Execução <ID>

- Data/hora:
- Repositório/commit:
- Branch:
- Executor:
- Postman CLI:
- Ambiente:
- Comando sanitizado:
- Resultado:
- Duração:
- Link do workflow/run:
- Artefatos:
- Observações:
- Segredos expostos: não
```
