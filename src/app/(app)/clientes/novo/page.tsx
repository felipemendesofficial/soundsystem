import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { criarCliente } from "../actions";
import { ClienteForm } from "../cliente-form";

export default async function NovoClientePage() {
  const session = await auth();
  const tabelasPreco = await db.tabelaPreco.findMany({
    where: { ativo: true, grupoId: session!.user.grupoId! },
    orderBy: { nome: "asc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Novo Cliente</h1>
      <ClienteForm action={criarCliente} tabelasPreco={tabelasPreco.map((t) => ({ id: t.id, nome: t.nome }))} />
    </div>
  );
}
