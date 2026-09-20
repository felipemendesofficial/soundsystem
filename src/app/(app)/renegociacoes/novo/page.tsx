import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { obterDadosFormularioLancamento } from "../../lancamentos-financeiros/dados-formulario";
import { criarRenegociacao } from "../actions";
import { RenegociacaoForm } from "../renegociacao-form";

export default async function NovaRenegociacaoPage() {
  const session = await auth();
  if (!session?.user || !podeGerenciarFinanceiro(session.user.perfil)) redirect("/");
  const grupoId = session.user.grupoId!;
  const empresaId = session.user.empresaId!;

  const [dados, abertos] = await Promise.all([
    obterDadosFormularioLancamento(grupoId, empresaId),
    db.lancamentoFinanceiro.findMany({
      where: { empresaId, status: "aberto" },
      include: { cliente: true, fornecedor: true },
      orderBy: { dataVencimento: "asc" },
    }),
  ]);

  const origensDisponiveis = abertos.map((l) => ({
    id: l.id,
    tipo: l.tipo,
    label: `${l.historicoSimplificado} — ${l.cliente?.nome ?? l.fornecedor?.nome ?? ""}`,
    valor: Number(l.valorOriginal),
    vencimento: l.dataVencimento.toISOString().slice(0, 10),
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Nova Renegociação</h1>
      <RenegociacaoForm
        action={criarRenegociacao}
        origensDisponiveis={origensDisponiveis}
        clientes={dados.clientes}
        fornecedores={dados.fornecedores}
        processos={dados.processos}
        processoItens={dados.processoItens}
      />
    </div>
  );
}
