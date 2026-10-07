import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { logoutAction } from "@/lib/actions/auth";
import { startSweeper } from "@/lib/simulation/sweeper";

export const dynamic = "force-dynamic";

const LINKS = [
  ["/painel", "Início"],
  ["/painel/notas", "Notas"],
  ["/painel/notas/nova", "Nova NFS-e"],
  ["/painel/empresas", "Empresas"],
  ["/painel/chaves", "Chaves"],
  ["/painel/webhooks", "Webhooks"],
  ["/painel/logs", "Logs"],
  ["/painel/saida", "Caixa de saída"],
  ["/painel/simulacao", "Simulação"],
  ["/painel/uso", "Uso"],
];

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  startSweeper();
  const { user, org } = await requireSession();
  return (
    <>
      <div className="ribbon">Ambiente de estudo · sem valor fiscal · sem integração com SEFAZ ou prefeitura</div>
      <div className="shell">
        <aside className="side">
          <Link href="/painel" className="brand">
            <strong>Bancada NFS-e</strong>
            <span>{org.name}</span>
          </Link>
          {LINKS.map(([href, label]) => (
            <Link key={href} href={href} className="nav">{label}</Link>
          ))}
          <div className="who">
            <div>{user.name}</div>
            <div>{user.email}</div>
            <form action={logoutAction}>
              <button className="linkish" type="submit">Sair</button>
            </form>
          </div>
        </aside>
        <main className="main">{children}</main>
      </div>
    </>
  );
}
