# Bancada NFS-e

Laboratório de estudo para o ciclo de uma NFS-e. A fila imita atraso e falha de prefeitura. Nenhum documento daqui tem valor fiscal e nada é enviado à SEFAZ.

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`. A documentação está em [`docs/`](docs/visao-geral.md).

```bash
npm test
```

Para testar a API por fora (Postman, curl ou CI), crie uma organização descartável com chaves:

```bash
npm run seed:poc
```

O script grava `data/poc.postman_environment.json` com `baseUrl`, `apiKey` e `orgToken`. A pasta `data/` não vai para o Git. Use `SEED_BASE_URL` e `SEED_OUTPUT` para mudar a URL e o arquivo, e `DATABASE_PATH` para apontar o mesmo banco do servidor.

Com a bancada no ar, rode os fluxos de ponta a ponta com o [Postman CLI](https://learning.postman.com/docs/postman-cli/postman-cli-overview/) e o `yq`:

```bash
npm run postman:e2e
```

O comando cria uma organização nova, roda a Collection `postman/collections/Bancada NFS-e Fluxos` e valida cada resposta contra os schemas de `contracts/openapi.yaml`. Nada é reportado ao Postman Cloud, salvo com `POSTMAN_REPORT_EVENTS=1`.
