import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { ClientesLista, type ItemCliente } from "@/components/clientes-lista";

function formatarMoeda(valor: unknown) {
  return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function ClientesPage() {
  const session = await auth();
  const clientes = await db.cliente.findMany({
    where: { grupoId: session!.user.grupoId! },
    orderBy: { nome: "asc" },
  });

  const saldosPorCliente = await db.saldoAdiantamentoTerceiro.groupBy({
    by: ["clienteId"],
    where: { clienteId: { in: clientes.map((c) => c.id) } },
    _sum: { saldoAtual: true },
  });
  const mapaSaldos = new Map(saldosPorCliente.map((s) => [s.clienteId, s._sum.saldoAtual!]));

  const itensLista: ItemCliente[] = clientes.map((c) => ({
    id: c.id,
    nome: c.nome,
    tipo: c.tipoCliente === "varejista" ? "Varejista" : "Atacadista",
    telefone: c.telefone ?? "-",
    email: c.email ?? "-",
    saldoAdiantamento: mapaSaldos.has(c.id) ? formatarMoeda(mapaSaldos.get(c.id)) : null,
    buscaTexto: [c.nome, c.telefone, c.email].filter(Boolean).join(" ").toLowerCase(),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Clientes</h1>
        <Button render={<Link href="/clientes/novo" />}>Novo Cliente</Button>
      </div>

      <ClientesLista itens={itensLista} />
    </div>
  );
}
