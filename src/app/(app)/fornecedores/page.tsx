import Link from "next/link";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { FornecedoresLista, type ItemFornecedor } from "@/components/fornecedores-lista";

export default async function FornecedoresPage() {
  const fornecedores = await db.fornecedor.findMany({ orderBy: { nome: "asc" } });

  const itensLista: ItemFornecedor[] = fornecedores.map((f) => ({
    id: f.id,
    nome: f.nome,
    tipo: f.tipoPessoa === "fisica" ? "Física" : "Jurídica",
    documento: f.documento ?? "-",
    telefone: f.telefone ?? "-",
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
