import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { LoginForm } from "@/components/forms";

export default async function LoginPage() {
  if (await getSession()) redirect("/painel");
  return (
    <>
      <div className="ribbon">Ambiente de estudo · sem valor fiscal · sem SEFAZ</div>
      <div className="auth-wrap">
        <div className="auth-card stack">
          <h1>Bancada NFS-e</h1>
          <p className="muted">Entre para emitir notas simuladas. Nada daqui chega a uma prefeitura.</p>
          <LoginForm />
          <p>Ainda não tem conta? <Link href="/cadastro">Criar bancada</Link></p>
        </div>
      </div>
    </>
  );
}
