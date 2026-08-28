import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { atualizarDeposito } from "../actions";
import { DepositoForm } from "../deposito-form";

export default async function EditarDepositoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deposito = await db.deposito.findUnique({ where: { id } });
  if (!deposito) notFound();

  const action = atualizarDeposito.bind(null, id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Editar Depósito</h1>
      <DepositoForm
        action={action}
        defaultValues={{ nome: deposito.nome, endereco: deposito.endereco }}
      />
    </div>
  );
}
