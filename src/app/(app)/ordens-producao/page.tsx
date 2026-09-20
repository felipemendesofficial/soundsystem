import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeLancarMovimentacao } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function formatarData(data: Date) {
  return data.toLocaleDateString("pt-BR");
}

export default async function OrdensProducaoPage() {
  const session = await auth();
  if (!session?.user || !podeLancarMovimentacao(session.user.perfil)) redirect("/");
  const empresaId = session.user.empresaId!;

  const ordens = await db.ordemProducao.findMany({
    where: { empresaId },
    include: { produtoFinal: true, depositoEntrada: true },
    orderBy: { criadoEm: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Ordens de Produção</h1>
        <Button render={<Link href="/ordens-producao/novo" />}>Nova</Button>
      </div>

      {ordens.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhuma Ordem de Produção cadastrada.
        </p>
      ) : (
        <ul className="space-y-2">
          {ordens.map((o) => (
            <li key={o.id}>
              <Link href={`/ordens-producao/${o.id}`} className="relative block rounded-lg border border-border bg-card p-3 text-sm active:bg-accent">
                <Badge variant={o.status === "processada" ? "default" : "secondary"} className="absolute top-3 right-3">
                  {o.status === "processada" ? "Processada" : "Aberta"}
                </Badge>
                <h2 className="pr-24 font-semibold">{o.produtoFinal.nome}</h2>
                <p className="text-xs text-muted-foreground">
                  {formatarData(o.criadoEm)} · Qtd {Number(o.quantidadeEntrada)} · Entra em {o.depositoEntrada.nome}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
