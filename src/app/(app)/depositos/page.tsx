import Link from "next/link";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { DepositosLista, type ItemDeposito } from "@/components/depositos-lista";

export default async function DepositosPage() {
  const depositos = await db.deposito.findMany({ orderBy: { nome: "asc" } });

  const itensLista: ItemDeposito[] = depositos.map((d) => ({
    id: d.id,
    nome: d.nome,
    endereco: d.endereco ?? "-",
    ativo: d.ativo,
    buscaTexto: [d.nome, d.endereco].filter(Boolean).join(" ").toLowerCase(),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Depósitos</h1>
        <Button render={<Link href="/depositos/novo" />}>Novo Depósito</Button>
      </div>

      <DepositosLista itens={itensLista} />
    </div>
  );
}
