# Webhooks

Cadastre em `POST /api/v1/webhooks/endpoints` ou no painel.

```json
{
  "url": "http://127.0.0.1:4000/hook",
  "events": ["nfse.issued", "nfse.error", "nfse.cancelled", "nfse.documents_ready"],
  "secret": "um-segredo"
}
```

Nesta bancada, `http://localhost` e `http://127.0.0.1` são aceitos de propósito, para o estudo rodar na mesma máquina.

Eventos:

- `nfse.issued` — a nota simulada foi emitida
- `nfse.error` — rejeição, timeout, indisponibilidade ou cota
- `nfse.cancelled` — cancelamento aceito
- `nfse.documents_ready` — PDF e XML de estudo disponíveis

O POST leva:

- `X-Notaas-Event`
- `X-Notaas-Delivery`
- `X-Notaas-Signature: sha256=...` quando há segredo

A assinatura é HMAC-SHA256 do corpo cru, em hexadecimal, com o prefixo `sha256=`.

A primeira tentativa é imediata. Se a URL responde fora de `2xx` ou a rede falha, há mais três tentativas, nas esperas configuradas em Simulação. O padrão é 10s, 30s e 60s. Um gateway em produção costuma espaçar isso em minutos e horas; aqui o intervalo é curto para caber numa aula.

`POST /api/v1/webhooks/endpoints/{id}/test` enfileira um `nfse.issued` marcado com `"teste": true`. O endpoint precisa assinar esse evento.

`GET /api/v1/webhooks/deliveries` lista o histórico, inclusive falhas.
