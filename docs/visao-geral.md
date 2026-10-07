# Bancada NFS-e

Laboratório local para estudar o ciclo de uma NFS-e: cadastro da empresa, fila, atraso, autorização simulada, erro, cancelamento, PDF, XML e webhook.

Nada neste projeto conversa com SEFAZ, prefeitura, Receita Federal ou um provedor fiscal. O PDF e o XML dizem que não têm valor fiscal. O código de verificação começa com `ESTUDO-` e não é chave oficial.

## O que existe

- Conta, organização e plano Estudo (50 notas emitidas, 5 CNPJs)
- Empresas, numeração de NFS-e, metadado de certificado A1 e logo
- API `/api/v1` com chave de projeto e token de organização
- Fila com atraso e falha configuráveis
- Webhooks com HMAC e retentativa curta
- Caixa de saída no lugar de e-mail real

## O que não existe

NF-e, NFC-e, emissão em lote, site público, cobrança, sandbox separado e qualquer transmissão oficial.

## Subir

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`, crie uma conta e cadastre uma empresa. A documentação continua nesta pasta.
