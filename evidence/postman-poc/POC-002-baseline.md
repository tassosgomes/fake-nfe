# Execução POC-002 / POC-004 — Baseline `fake-nfe`

- Data/hora: 2026-10-14
- Repositório/commit: `tassosgomes/fake-nfe` @ `ac5306e` (merge do PR #1)
- Branch: `poc/postman-fake-nfe-contract`
- Executor: Claude Code (agente), a pedido de tasso-gomes
- Postman CLI: `1.74.0` (atualizado de 1.70.0 em 2026-10-14)
- Ambiente: WSL2 Linux 6.18, Node `v24.20.0`, npm `11.19.0`
- Segredos expostos: não

## Resultado

| Comando | Resultado | Duração |
| --- | --- | ---: |
| `npm ci` | ok (1 aviso de dependência deprecada: `prebuild-install`) | 25 s |
| `npm run typecheck` | ok | 3 s |
| `npm test` | 12 testes, 12 passaram, 0 falhas | 2 s (1,9 s de testes) |
| `npm run build` | ok, 26 rotas (18 de API) | 43 s |

## Observações

- Os testes chamam os handlers das rotas direto, sem servidor HTTP. Nenhum teste existente exercita a API via HTTP real. A Collection Postman vai ser a primeira cobertura desse tipo.
- Os testes usam SQLite temporário (`DATABASE_PATH`) e desligam o varredor da fila (`DISABLE_SWEEPER=1`), avançando a simulação com `runTick`.
- Não há workflow de CI no repositório (`.github/` ausente).
- Smoke HTTP com `next start` e banco temporário confirmou os comportamentos de autenticação descritos no inventário.

## Postman

- Conta: `tasso-gomes`, time ECAD (`ecadbr`), papel Developer.
- Papéis Enterprise (API Catalog Manager, API Network Manager, Partner Manager) solicitados, ainda não concedidos. Bloqueiam FNFE-008/009.
- Duas instalações do CLI (`~/.local/bin` e global do npm), ambas em 1.74.0. O PATH usa `~/.local/bin`. O workflow de CI deve fixar a versão explicitamente.
