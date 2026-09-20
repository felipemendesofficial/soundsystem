import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PERIODICIDADE_LABEL } from "@/lib/financeiro-labels";
import { alternarAtivoRecorrente } from "./actions";

export default async function LancamentosFinanceirosRecorrentesPage() {
  const session = await auth();
  if (!session?.user || !podeGerenciarFinanceiro(session.user.perfil)) redirect("/");
  const empresaId = session.user.empresaId!;

  const recorrentes = await db.lancamentoFinanceiroRecorrente.findMany({
    where: { empresaId },
    include: { cliente: true, fornecedor: true },
    orderBy: { descricao: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Lançamentos Recorrentes</h1>
        <Button render={<Link href="/lancamentos-financeiros-recorrentes/novo" />}>Novo</Button>
      </div>

      <Button variant="outline" className="w-full" render={<Link href="/lancamentos-financeiros-recorrentes/gerar" />}>
        Gerar Pendentes
      </Button>

      {recorrentes.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhum lançamento recorrente cadastrado.
        </p>
      ) : (
        <ul className="space-y-2">
          {recorrentes.map((r) => (
            <li key={r.id} className="rounded-lg border border-border bg-card p-3 text-sm">
              <Link href={`/lancamentos-financeiros-recorrentes/${r.id}`} className="relative block">
                <Badge variant={r.ativo ? "default" : "secondary"} className="absolute top-0 right-0">
                  {r.ativo ? "Ativo" : "Inativo"}
                </Badge>
                <h2 className="pr-16 text-[15px] font-semibold">{r.descricao}</h2>
                <p className="text-xs text-muted-foreground">
                  {r.tipo === "despesa" ? "Despesa" : "Receita"} · {PERIODICIDADE_LABEL[r.periodicidade]} · dia {r.diaVencimento} · {r.cliente?.nome ?? r.fornecedor?.nome ?? "-"}
                </p>
              </Link>
              <form action={alternarAtivoRecorrente.bind(null, r.id, !r.ativo)} className="mt-2">
                <Button type="submit" variant="outline" size="sm" className={r.ativo ? "border-destructive text-destructive hover:bg-destructive/10" : ""}>
                  {r.ativo ? "Desativar" : "Ativar"}
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
