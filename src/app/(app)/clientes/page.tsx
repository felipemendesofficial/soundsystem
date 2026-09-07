import Link from "next/link";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { ClientesLista, type ItemCliente } from "@/components/clientes-lista";

export default async function ClientesPage() {
  const clientes = await db.cliente.findMany({ orderBy: { nome: "asc" } });

  const itensLista: ItemCliente[] = clientes.map((c) => ({
    id: c.id,
    nome: c.nome,
    tipo: c.tipoCliente === "varejista" ? "Varejista" : "Atacadista",
    telefone: c.telefone ?? "-",
    email: c.email ?? "-",
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
