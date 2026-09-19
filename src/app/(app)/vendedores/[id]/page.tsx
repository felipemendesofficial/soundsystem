import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { atualizarVendedor } from "../actions";
import { VendedorForm } from "../vendedor-form";

function formatarMoeda(valor: unknown) {
  return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function EditarVendedorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const vendedor = await db.vendedor.findFirst({ where: { id, grupoId: session!.user.grupoId! } });
  if (!vendedor) notFound();

  const action = atualizarVendedor.bind(null, id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Editar Vendedor</h1>

      <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4 text-sm">
        <span className="text-muted-foreground">Saldo de comissão</span>
        <span className="text-base font-semibold">{formatarMoeda(vendedor.saldoComissao)}</span>
      </div>

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

      <Link href={`/vendedores/${id}/extrato`} className="block text-center text-sm font-medium text-primary">
        Ver extrato de comissão
      </Link>
    </div>
  );
}
