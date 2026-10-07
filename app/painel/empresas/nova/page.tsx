import { EmpresaForm } from "@/components/forms";

export const dynamic = "force-dynamic";

export default function NovaEmpresaPage() {
  return (
    <div className="stack">
      <h1>Nova empresa</h1>
      <p className="muted">O CNPJ é conferido pelos dígitos, mas não existe consulta à Receita neste laboratório.</p>
      <EmpresaForm />
    </div>
  );
}
