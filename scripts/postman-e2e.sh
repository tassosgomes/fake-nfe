#!/usr/bin/env bash
# Roda a Collection "Bancada NFS-e Fluxos" contra a bancada que já está no ar.
#
# 1. Cria uma organização descartável (npm run seed:poc), salvo com SKIP_SEED=1.
#    Use o mesmo DATABASE_PATH do servidor.
# 2. Injeta components.schemas de contracts/openapi.yaml em `contractSchemas`,
#    para as respostas serem validadas contra o contrato sem copiá-lo para a Collection.
# 3. Não reporta ao API Catalog, salvo com POSTMAN_REPORT_EVENTS=1.
#
# Argumentos extras vão direto para `postman collection run` (ex.: --bail, -r junit).
set -euo pipefail
cd "$(dirname "$0")/.."

env_file="${POSTMAN_ENV_FILE:-data/poc.postman_environment.json}"
if [ "${SKIP_SEED:-0}" != "1" ]; then
  SEED_OUTPUT="$env_file" npm run -s seed:poc
fi

report="--no-report-events"
if [ "${POSTMAN_REPORT_EVENTS:-0}" = "1" ]; then
  report="--report-events"
fi

schemas="$(yq -o=json -I0 '.components.schemas' contracts/openapi.yaml)"

exec postman collection run "postman/collections/Bancada NFS-e Fluxos" \
  -e "$env_file" \
  --env-var "contractSchemas=$schemas" \
  "$report" \
  "$@"
