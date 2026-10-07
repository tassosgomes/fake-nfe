# Emitir, consultar e cancelar

Base: `/api/v1`. Toda resposta leva `X-Ambiente: estudo`.

## Emitir

`POST /api/v1/emitir` responde `202` com `invoiceId`. A nota nasce `queued`. Ela não está autorizada nessa resposta.

```bash
curl -X POST http://localhost:3000/api/v1/emitir \
  -H "content-type: application/json" \
  -H "x-api-key: ntaas_SUA_CHAVE" \
  -d '{
    "tomador": { "nome": "Cliente Exemplo LTDA", "cnpj": "19131243000197", "email": "financeiro@cliente.test" },
    "servico": { "descricao": "Aula de integração", "codigo": "010700" },
    "valores": { "total": 1500, "aliquotaIss": 2 },
    "competencia": "2026-03"
  }'
```

O tomador precisa de CNPJ, CPF ou NIF. CNPJ e CPF passam pela validação dos dígitos. Grupos como exportação, obra, evento, dedução, retenção e IBS/CBS são guardados e reaparecem no XML de estudo. Não há cálculo de imposto.

Se o tomador tem e-mail, a emissão bem-sucedida cria um item na caixa de saída do painel. Nenhum SMTP é chamado.

## Consultar

`GET /api/v1/invoices/{id}/status`

Estados: `queued`, `processing`, `issued`, `error`, `cancel_queued`, `cancelled`.

`issued` e `cancelled` liberam:

- `GET /api/v1/invoices/{id}/pdf`
- `GET /api/v1/invoices/{id}/xml`
- `GET /api/v1/invoices/{id}/xml?type=cancel` só depois do cancelamento

O PDF traz a faixa "sem valor fiscal". O XML usa a raiz `NfseEstudo`, sem o leiaute oficial.

## Cancelar

`POST /api/v1/cancelar` com `invoiceId`. O motivo é opcional; se vier, precisa ter de 15 a 255 caracteres. Também entra na fila. Se a prefeitura simulada recusa, a nota volta para `issued` e o status mostra `cancelamentoRecusado`.

## Cota

O plano Estudo conta uma nota quando ela chega a `issued`. Erro simulado não consome crédito. Com a cota cheia, a emissão responde `403`. Se duas notas estavam na fila e só cabe uma, a segunda termina com o código `E004`.
