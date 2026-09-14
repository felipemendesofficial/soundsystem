import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { atualizarVendedor } from "../actions";
import { VendedorForm } from "../vendedor-form";

export default async function EditarVendedorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const vendedor = await db.vendedor.findFirst({ where: { id, grupoId: session!.user.grupoId! } });
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
