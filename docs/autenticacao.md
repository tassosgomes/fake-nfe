# Autenticação e chaves

O painel usa cookie de sessão. A API usa o header `x-api-key`.

| Chave | Prefixo | Onde vale |
| --- | --- | --- |
| Projeto | `ntaas_` | emitir, cancelar, consultar, PDF, XML e webhooks |
| Organização | `ntaas_org_` | empresas, numeração, chaves de projeto, certificado, logo e domínio |

A chave completa aparece uma única vez, no painel ou na resposta `201`. Depois só o prefixo fica visível. Revogar faz a chave parar na hora e a API responde `403`.

Escopos da chave de projeto: `emit`, `cancel`, `query`, `webhooks`.

Escopos do token de organização: `projects:read`, `projects:write`, `api_keys:manage`, `settings:read`, `settings:write`, `certificates:write`.

## Limite

Cada chave tem um teto por minuto. Ao passar, a resposta é `429` com `Retry-After: 60`.

## Idempotência

Mutações de emissão e cancelamento aceitam `Idempotency-Key` com até 80 caracteres `[A-Za-z0-9_-]`. A mesma chave e o mesmo corpo devolvem a primeira resposta, com o header `Idempotent-Replayed: true`. Outro corpo com a mesma chave devolve `409`.

## Empresas

`POST /api/v1/org/projects` cria o prestador. O CNPJ é validado pelos dígitos e não pode repetir entre empresas ativas. `DELETE` desativa a empresa, revoga as chaves dela e preserva as notas.

`GET` e `PATCH /api/v1/org/projects/{id}/numeracao` leem e avançam o último número da NFS-e. Um número menor é ignorado.

O upload de certificado exige arquivo e senha, como no contrato de um gateway real, mas a bancada descarta a senha, não abre o arquivo e não assina nada.
