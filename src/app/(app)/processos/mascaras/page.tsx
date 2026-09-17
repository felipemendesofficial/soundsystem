import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { Button } from "@/components/ui/button";

export default async function MascarasProcessoPage() {
  const session = await auth();
  if (!session?.user || !podeGerenciarFinanceiro(session.user.perfil)) redirect("/");

  const mascaras = await db.mascaraProcesso.findMany({
    where: { grupoId: session.user.grupoId! },
    include: { segmentos: { orderBy: { ordem: "asc" } }, _count: { select: { processos: true } } },
    orderBy: { nome: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Máscaras de Processo</h1>
        <Button render={<Link href="/processos/mascaras/novo" />}>Nova Máscara</Button>
      </div>

      {mascaras.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhuma máscara cadastrada.
        </p>
      ) : (
        <ul className="space-y-2">
          {mascaras.map((m) => (
            <li key={m.id}>
              <Link
                href={`/processos/mascaras/${m.id}`}
                className="block rounded-lg border border-border bg-card p-3 active:bg-accent"
              >
                <h2 className="mb-1 text-[15px] font-semibold">{m.nome}</h2>
                <p className="text-[13px] text-muted-foreground">
                  {m.segmentos.map((s) => s.qtdDigitos).join(".")} · {m._count.processos} processo(s)
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
