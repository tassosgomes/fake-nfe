import Link from "next/link";

export default function NotFound() {
  return (
    <div className="auth-wrap">
      <div className="auth-card stack">
        <h1>Não encontrado</h1>
        <p>Esse caminho não existe na bancada.</p>
        <Link className="button" href="/painel">Voltar</Link>
      </div>
    </div>
  );
}
