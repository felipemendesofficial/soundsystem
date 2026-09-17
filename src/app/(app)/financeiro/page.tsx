import Link from "next/link";
import { redirect } from "next/navigation";
import { Landmark, Users, Wallet, Layers, GitBranch, Receipt, CalendarCheck } from "lucide-react";
import { auth } from "@/lib/auth";
import { podeGerenciarFinanceiro } from "@/lib/permissions";

const SECOES = [
  { href: "/lancamentos-financeiros", label: "Lançamentos", descricao: "Contas a pagar e a receber", icon: Receipt },
  { href: "/contas-financeiras", label: "Contas Financeiras", descricao: "Bancos, caixas e fundos fixos", icon: Landmark },
  { href: "/portadores", label: "Portadores", descricao: "Quem carrega boletos/cheques físicos", icon: Users },
  { href: "/planos-financeiros", label: "Plano Financeiro", descricao: "Plano de contas de receitas e despesas", icon: Wallet },
  { href: "/centros-custo", label: "Centro de Custo", descricao: "Rateio por área/departamento", icon: Layers },
  { href: "/processos", label: "Processos", descricao: "Rateio por processo/projeto", icon: GitBranch },
  { href: "/fechamento-diario", label: "Fechamento Diário", descricao: "Fecha e reabre dias de movimento", icon: CalendarCheck },
];

export default async function FinanceiroPage() {
  const session = await auth();
  if (!session?.user || !podeGerenciarFinanceiro(session.user.perfil)) redirect("/");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Financeiro</h1>

      <ul className="space-y-2">
        {SECOES.map(({ href, label, descricao, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 active:bg-accent"
            >
              <Icon className="size-5 flex-none text-primary" />
              <div className="min-w-0">
                <div className="text-[15px] font-semibold">{label}</div>
                <div className="truncate text-[13px] text-muted-foreground">{descricao}</div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
