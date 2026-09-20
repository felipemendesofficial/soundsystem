import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function formatarData(data: Date) {
  return data.toLocaleDateString("pt-BR");
}

export default async function RenegociacoesPage() {
  const session = await auth();
  if (!session?.user || !podeGerenciarFinanceiro(session.user.perfil)) redirect("/");
  const empresaId = session.user.empresaId!;

  const renegociacoes = await db.renegociacao.findMany({
    where: { empresaId },
    include: { origens: true, destinos: true },
    orderBy: { criadoEm: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Renegociações</h1>
        <Button render={<Link href="/renegociacoes/novo" />}>Nova</Button>
      </div>

      {renegociacoes.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhuma renegociação registrada.
        </p>
      ) : (
        <ul className="space-y-2">
          {renegociacoes.map((r) => (
            <li key={r.id}>
              <Link href={`/renegociacoes/${r.id}`} className="relative block rounded-lg border border-border bg-card p-3 text-sm active:bg-accent">
                <Badge variant={r.tipo === "despesa" ? "secondary" : "default"} className="absolute top-3 right-3">
                  {r.tipo === "despesa" ? "Despesa" : "Receita"}
                </Badge>
                <h2 className="pr-20 font-semibold">{r.motivo}</h2>
                <p className="text-xs text-muted-foreground">
                  {formatarData(r.criadoEm)} · {r.origens.length} origem(ns) → {r.destinos.length} destino(s)
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
