import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { OperadorasCartaoLista, type ItemOperadoraCartao } from "@/components/operadoras-cartao-lista";

export default async function OperadorasCartaoPage() {
  const session = await auth();
  if (!session?.user || !podeGerenciarFinanceiro(session.user.perfil)) redirect("/");
  const empresaId = session.user.empresaId!;

  const operadoras = await db.operadoraCartao.findMany({
    where: { empresaId },
    include: { _count: { select: { taxas: true } } },
    orderBy: { descricao: "asc" },
  });

  const itensLista: ItemOperadoraCartao[] = operadoras.map((o) => ({
    id: o.id,
    descricao: o.descricao,
    cnpj: o.cnpj,
    totalTaxas: o._count.taxas,
    ativo: o.ativo,
    buscaTexto: [o.descricao, o.cnpj].filter(Boolean).join(" ").toLowerCase(),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Operadoras de Cartão</h1>
        <Button render={<Link href="/operadoras-cartao/novo" />}>Nova Operadora</Button>
      </div>

      <OperadorasCartaoLista itens={itensLista} />
    </div>
  );
}
