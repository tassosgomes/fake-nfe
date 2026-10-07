# Lentidão e falha

A organização tem atraso mínimo, atraso máximo e uma chance de falha de 0 a 100. O padrão inicial é 2s a 6s, com 15% de falha.

Cada emissão sorteia um cenário e grava o resultado antes da espera. O detalhe da nota mostra se o cenário foi sorteado ou forçado. A espera continua mesmo quando o resultado já está decidido: a aula é sobre a fila, não sobre um sorteio escondido.

Estados da emissão:

1. `queued` — aceita, ainda no primeiro trecho do atraso
2. `processing` — a prefeitura simulada "recebeu" e ainda não respondeu
3. `issued` ou `error`

Falhas:

| Cenário | Código | Efeito |
| --- | --- | --- |
| `rejeicao` | E001 | Código de serviço recusado |
| `timeout` | E002 | Sem resposta no prazo |
| `indisponivel` | E003 | Autorizador fora do ar |
| cota | E004 | Créditos acabaram no meio da fila |

O cancelamento usa a mesma roleta, com mensagens próprias. `sucesso` cancela. Os outros devolvem a nota para `issued`.

## Forçar um resultado

No corpo:

```json
{ "simulacao": { "resultado": "timeout", "atrasoMs": 1500 } }
```

Ou no header, que perde para o corpo se os dois vierem:

```http
X-Simulacao: timeout:1500
```

`atrasoMs` vai de 0 a 120000. Zero conclui no próximo ciclo do varredor, ainda assim em um passo separado da resposta `202`.

O painel em Simulação também sorteia 10 resultados com a taxa atual, sem criar nota, para enxergar a proporção de falhas.
