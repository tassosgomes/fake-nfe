import { requireSession } from "@/lib/auth/session";
import { SimulationForm } from "@/components/forms";
import { parseJson } from "@/lib/format";
import { DEFAULT_RETRIES } from "@/lib/plan";

export const dynamic = "force-dynamic";

export default async function SimulacaoPage() {
  const { org } = await requireSession();
  return (
    <div className="stack">
      <h1>Simulação</h1>
      <p className="muted">
        Estes números valem para a organização inteira. Uma nota ainda pode forçar o resultado no formulário, no corpo
        simulacao ou no header X-Simulacao. A Notaas real espera minutos ou horas no retry; aqui o padrão é 10s, 30s e 60s
        para a aula caber numa sessão.
      </p>
      <SimulationForm
        min={org.latencyMinMs}
        max={org.latencyMaxMs}
        rate={org.failureRate}
        retries={parseJson<number[]>(org.retryDelaysJson, DEFAULT_RETRIES)}
      />
    </div>
  );
}
