import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  podeGerenciarFinanceiro,
  podeGerenciarOrcamento,
  podeGerenciarTabelaPreco,
  podeGerenciarUsuarios,
  podeGerenciarVendedor,
} from "@/lib/permissions";
import { TopBar } from "@/components/app-shell/top-bar";
import { BottomNav } from "@/components/app-shell/bottom-nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.empresaId) redirect("/selecionar-empresa");

  const isAdmin = podeGerenciarUsuarios(session.user.perfil);
  const podeVerOrcamentos = podeGerenciarOrcamento(session.user.perfil);
  const podeVerTabelaPrecos = podeGerenciarTabelaPreco(session.user.perfil);
  const podeVerVendedores = podeGerenciarVendedor(session.user.perfil);
  const podeVerFinanceiro = podeGerenciarFinanceiro(session.user.perfil);

  const empresa = await db.empresa.findUnique({
    where: { id: session.user.empresaId },
    include: { grupo: true },
  });

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[400px] flex-col bg-background">
      <TopBar
        name={session.user.name}
        perfil={session.user.perfil}
        grupoNome={empresa?.grupo.nome ?? "-"}
        empresaNome={empresa?.nome ?? "-"}
      />
      <main className="flex-1 px-[18px] pb-[86px] pt-[18px]">{children}</main>
      <BottomNav
        isAdmin={isAdmin}
        podeVerOrcamentos={podeVerOrcamentos}
        podeVerTabelaPrecos={podeVerTabelaPrecos}
        podeVerVendedores={podeVerVendedores}
        podeVerFinanceiro={podeVerFinanceiro}
      />
    </div>
  );
}
