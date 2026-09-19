import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { FornecedoresLista, type ItemFornecedor } from "@/components/fornecedores-lista";

function formatarMoeda(valor: unknown) {
  return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function FornecedoresPage() {
  const session = await auth();
  const fornecedores = await db.fornecedor.findMany({
    where: { grupoId: session!.user.grupoId! },
    orderBy: { nome: "asc" },
  });

  const saldosPorFornecedor = await db.saldoAdiantamentoTerceiro.groupBy({
    by: ["fornecedorId"],
    where: { fornecedorId: { in: fornecedores.map((f) => f.id) } },
    _sum: { saldoAtual: true },
  });
  const mapaSaldos = new Map(saldosPorFornecedor.map((s) => [s.fornecedorId, s._sum.saldoAtual!]));

  const itensLista: ItemFornecedor[] = fornecedores.map((f) => ({
    id: f.id,
    nome: f.nome,
    tipo: f.tipoPessoa === "fisica" ? "Física" : "Jurídica",
    documento: f.documento ?? "-",
    telefone: f.telefone ?? "-",
    saldoAdiantamento: mapaSaldos.has(f.id) ? formatarMoeda(mapaSaldos.get(f.id)) : null,
    buscaTexto: [f.nome, f.documento, f.telefone, f.email].filter(Boolean).join(" ").toLowerCase(),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Fornecedores</h1>
        <Button render={<Link href="/fornecedores/novo" />}>Novo Fornecedor</Button>
      </div>

      <FornecedoresLista itens={itensLista} />
    </div>
  );
}
