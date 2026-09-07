import Link from "next/link";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { ServicosLista, type ItemServico } from "@/components/servicos-lista";

function formatarMoeda(valor: unknown) {
  return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function ServicosPage() {
  const servicos = await db.servico.findMany({ orderBy: { nome: "asc" } });

  const itensLista: ItemServico[] = servicos.map((s) => ({
    id: s.id,
    nome: s.nome,
    precoPadrao: formatarMoeda(s.precoPadrao),
    ativo: s.ativo,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Serviços</h1>
        <Button render={<Link href="/servicos/novo" />}>Novo Serviço</Button>
      </div>

      <ServicosLista itens={itensLista} />
    </div>
  );
}
