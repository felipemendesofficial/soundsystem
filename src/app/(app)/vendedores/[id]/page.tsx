import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { atualizarVendedor } from "../actions";
import { VendedorForm } from "../vendedor-form";

export default async function EditarVendedorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const vendedor = await db.vendedor.findUnique({ where: { id } });
  if (!vendedor) notFound();

  const action = atualizarVendedor.bind(null, id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Editar Vendedor</h1>
      <VendedorForm
        action={action}
        defaultValues={{
          nome: vendedor.nome,
          ativo: vendedor.ativo,
          recebeComissao: vendedor.recebeComissao,
          tipoComissao: vendedor.tipoComissao,
          valorComissao: vendedor.valorComissao?.toString() ?? null,
        }}
      />
    </div>
  );
}
