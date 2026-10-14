# Execução FNFE-003 — Bootstrap Native Git

- Data/hora: 2026-10-14
- Branch: `poc/postman-fake-nfe-contract`
- Executor: Claude Code (agente), a pedido de tasso-gomes
- Postman CLI: `1.74.0`
- Workspace: `POC - fake-nfe`, tipo Internal, acesso "Only you and invited people", criado manualmente na interface
- Segredos expostos: não

## Sequência

| Passo | Comando sanitizado | Resultado |
| --- | --- | --- |
| 1 | escrever `.postman/resources.yaml` com `localResources.specs: [../contracts/openapi.yaml]` | necessário porque o `init` não descobre specs em `contracts/` (ver FNFE-002) |
| 2 | `postman init --dry-run --json` | exit 0, spec `contracts/openapi.yaml` com `source: existing-config`, nada sobrescrito |
| 3 | `postman init --json </dev/null` | exit 0, só arquivos locais (sem TTY e sem `--visibility`, não cria workspace) |
| 4 | `postman workspace connect-git <WORKSPACE_ID> --json` | `connected: true`, grava o `workspace.id` no manifest |
| 5 | `postman workspace lint` | 0 erros, 1 warning: o workspace não tem ruleset de governança |
| 6 | `postman workspace diff` | 1 spec a criar, nada a apagar |
| 7 | `postman workspace push --yes --no-report-events --json` | spec criado, globals atualizado, 0 apagados, 0 falhas |
| 8 | comparação do arquivo na cloud com o Git (API `GET /specs/{id}/files/...`) | conteúdo idêntico |

## Arquivos versionados

- `.postman/resources.yaml`: spec local, `workspace.id` e o mapeamento `cloudResources` gravado pelo push.
- `.postman/skills.json`: origem e hash das skills (`postmanlabs/postman-plugin`, branch `main`).
- `AGENTS.md`: 3 linhas, aponta para `postman/skills/api-engineer/SKILL.md`.
- `postman/skills/**`: 17 skills, 316 KB.
- `postman/globals/workspace.globals.yaml`: vazio.

O repositório é público, então o `workspace.id` fica público. Decisão do usuário (2026-10-14): aceitar, porque o ID não dá acesso e o workspace é privado.

## Achados

1. **Um spec fora dos diretórios convencionais sincroniza.** Push criou o spec a partir de `contracts/openapi.yaml`, preservando o caminho como arquivo `ROOT`. Hipótese validada para o CFC-003.
2. **`workspace diff` e `push` sugerem `--push-strategy force-sync`,** que apaga na cloud o que não existe localmente. A POC usa a estratégia padrão (cria e atualiza).
3. **Depois do push, o `diff` mostra o spec como "Not compared"** em vez de "no changes". Comparação feita pela API, conteúdo idêntico.
4. **`connect-git` aceita subpasta**, ligando cada pasta a um workspace diferente: caminho natural para o monorepo do `code-for-coders`.
5. **Passos manuais:** criar o workspace na interface (escolha do usuário para controlar o acesso) e escrever o manifest à mão.

## Gate FNFE-003

- [x] `.postman/resources.yaml` válido (`workspace lint` sem erro).
- [x] Workspace privado conectado.
- [x] Arquivos Postman versionáveis identificados.
- [x] Nenhuma alteração fora do escopo; o contrato continua em `contracts/`.
