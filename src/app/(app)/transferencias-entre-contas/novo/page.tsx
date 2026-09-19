import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { criarTransferencia } from "../actions";
import { TransferenciaForm } from "../transferencia-form";

export default async function NovaTransferenciaPage() {
  const session = await auth();
  if (!session?.user || !podeGerenciarFinanceiro(session.user.perfil)) redirect("/");
  const empresaId = session.user.empresaId!;
  const grupoId = session.user.grupoId!;

  const [contas, clientes, fornecedores] = await Promise.all([
    db.contaFinanceira.findMany({ where: { empresaId, ativo: true }, orderBy: { nome: "asc" } }),
    db.cliente.findMany({ where: { grupoId }, orderBy: { nome: "asc" } }),
    db.fornecedor.findMany({ where: { grupoId }, orderBy: { nome: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Nova Transferência</h1>
      <TransferenciaForm
        action={criarTransferencia}
        cancelarHref="/transferencias-entre-contas"
        contas={contas.map((c) => ({
          id: c.id,
          label: c.nome,
          tipo: c.tipo,
          adiantamentoCliente: c.adiantamentoCliente,
          adiantamentoFornecedor: c.adiantamentoFornecedor,
        }))}
        clientes={clientes.map((c) => ({ id: c.id, label: c.nome }))}
        fornecedores={fornecedores.map((f) => ({ id: f.id, label: f.nome }))}
      />
    </div>
  );
}
