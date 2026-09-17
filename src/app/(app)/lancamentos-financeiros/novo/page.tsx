import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { criarLancamentoFinanceiro } from "../actions";
import { LancamentoFinanceiroForm } from "../lancamento-financeiro-form";

export default async function NovoLancamentoFinanceiroPage() {
  const session = await auth();
  if (!session?.user || !podeGerenciarFinanceiro(session.user.perfil)) redirect("/");
  const grupoId = session.user.grupoId!;
  const empresaId = session.user.empresaId!;

  const [clientes, fornecedores, portadores, contasFinanceiras, processos, planoFinanceiro, centroCusto, processoItens, vendedores] =
    await Promise.all([
      db.cliente.findMany({ where: { grupoId }, orderBy: { nome: "asc" } }),
      db.fornecedor.findMany({ where: { grupoId }, orderBy: { nome: "asc" } }),
      db.portador.findMany({ where: { empresaId, ativo: true }, orderBy: { nome: "asc" } }),
      db.contaFinanceira.findMany({ where: { empresaId, ativo: true }, orderBy: { nome: "asc" } }),
      db.processo.findMany({ where: { empresaId, ativo: true }, orderBy: { nome: "asc" } }),
      db.planoFinanceiro.findMany({ where: { grupoId, natureza: "analitica", ativo: true }, orderBy: { codigo: "asc" } }),
      db.centroCusto.findMany({ where: { grupoId, natureza: "analitica", ativo: true }, orderBy: { codigo: "asc" } }),
      db.processoItem.findMany({
        where: { processo: { empresaId }, natureza: "analitica", ativo: true },
        orderBy: { codigo: "asc" },
      }),
      db.vendedor.findMany({ where: { grupoId, ativo: true, recebeComissao: true }, orderBy: { nome: "asc" } }),
    ]);

  const processoPadrao = processos.find((p) => p.padrao);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Novo Lançamento Financeiro</h1>
      <LancamentoFinanceiroForm
        action={criarLancamentoFinanceiro}
        clientes={clientes.map((c) => ({ id: c.id, label: c.nome }))}
        fornecedores={fornecedores.map((f) => ({ id: f.id, label: f.nome }))}
        portadores={portadores.map((p) => ({ id: p.id, label: p.nome }))}
        contasFinanceiras={contasFinanceiras.map((c) => ({ id: c.id, label: c.nome }))}
        processos={processos.map((p) => ({ id: p.id, label: p.nome }))}
        processoPadraoId={processoPadrao?.id}
        planoFinanceiro={planoFinanceiro.map((p) => ({ id: p.id, label: `${p.codigo} — ${p.descricao}`, tipo: p.tipo }))}
        centroCusto={centroCusto.map((c) => ({ id: c.id, label: `${c.codigo} — ${c.descricao}` }))}
        processoItens={processoItens.map((i) => ({ id: i.id, label: `${i.codigo} — ${i.descricao}`, processoId: i.processoId }))}
        vendedores={vendedores.map((v) => ({ id: v.id, label: v.nome }))}
      />
    </div>
  );
}
