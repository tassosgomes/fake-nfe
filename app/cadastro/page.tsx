import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { RegisterForm } from "@/components/forms";

export default async function RegisterPage() {
  if (await getSession()) redirect("/painel");
  return (
    <>
      <div className="ribbon">Ambiente de estudo · sem valor fiscal · sem SEFAZ</div>
      <div className="auth-wrap">
        <div className="auth-card stack">
          <h1>Criar bancada</h1>
          <p className="muted">Cada conta nasce com uma organização e o plano Estudo: 50 notas e 5 CNPJs.</p>
          <RegisterForm />
          <p>Já tem conta? <Link href="/login">Entrar</Link></p>
        </div>
      </div>
    </>
  );
}
