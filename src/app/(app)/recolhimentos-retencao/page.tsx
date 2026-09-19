import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { Prisma } from "@/generated/prisma/client";

function formatarMoeda(valor: unknown) {
  return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function RecolhimentosRetencaoPage() {
  const session = await auth();
  if (!session?.user || !podeGerenciarFinanceiro(session.user.perfil)) redirect("/");
  const empresaId = session.user.empresaId!;

  const retencoes = await db.retencao.findMany({
    where: { status: "pendente", lancamento: { empresaId, status: "baixado" } },
    include: { plano: true },
  });

  const grupos = new Map<string, { plano: { codigo: string; descricao: string }; total: Prisma.Decimal; count: number }>();
  for (const r of retencoes) {
    const atual = grupos.get(r.planoId);
    if (atual) {
      atual.total = atual.total.plus(r.valor);
      atual.count += 1;
    } else {
      grupos.set(r.planoId, { plano: r.plano, total: r.valor, count: 1 });
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Recolhimento de Retenção</h1>

      {grupos.size === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhuma retenção pendente pra recolher (só entram aqui retenções de lançamentos já baixados).
        </p>
      ) : (
        <ul className="space-y-2">
          {[...grupos.entries()].map(([planoId, grupo]) => (
            <li key={planoId}>
              <Link
                href={`/recolhimentos-retencao/${planoId}`}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-4 active:bg-accent"
              >
                <div className="min-w-0">
                  <div className="truncate text-[15px] font-semibold">{grupo.plano.codigo} — {grupo.plano.descricao}</div>
                  <div className="text-xs text-muted-foreground">{grupo.count} retenção(ões) pendente(s)</div>
                </div>
                <span className="flex-none font-semibold">{formatarMoeda(grupo.total)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
