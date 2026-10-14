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
