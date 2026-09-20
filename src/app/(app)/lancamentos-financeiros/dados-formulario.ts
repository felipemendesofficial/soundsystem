import { db } from "@/lib/db";

/**
 * Dados de referência (combos) compartilhados entre "novo" e "editar" — junto
 * com os padrões de UX: portador/processo pré-selecionados quando só existe
 * uma opção cadastrada (padrão explícito de Processo continua tendo prioridade).
 */
export async function obterDadosFormularioLancamento(grupoId: string, empresaId: string) {
  const [clientes, fornecedores, portadores, contasFinanceiras, processos, planoFinanceiro, centroCusto, processoItens, vendedores, operadorasCartao] =
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
      db.vendedor.findMany({ where: { grupoId, ativo: true }, orderBy: { nome: "asc" } }),
      db.operadoraCartao.findMany({ where: { empresaId, ativo: true }, orderBy: { descricao: "asc" } }),
    ]);

  const processoPadrao = processos.find((p) => p.padrao) ?? (processos.length === 1 ? processos[0] : undefined);
  const portadorPadraoId = portadores.length === 1 ? portadores[0].id : undefined;

  return {
    clientes: clientes.map((c) => ({ id: c.id, label: c.nome })),
    fornecedores: fornecedores.map((f) => ({ id: f.id, label: f.nome })),
    portadores: portadores.map((p) => ({ id: p.id, label: p.nome })),
    contasFinanceiras: contasFinanceiras.map((c) => ({
      id: c.id,
      label: c.nome,
      tipo: c.tipo,
      adiantamentoCliente: c.adiantamentoCliente,
      adiantamentoFornecedor: c.adiantamentoFornecedor,
    })),
    processos: processos.map((p) => ({ id: p.id, label: p.nome })),
    processoPadraoId: processoPadrao?.id,
    portadorPadraoId,
    planoFinanceiro: planoFinanceiro.map((p) => ({
      id: p.id,
      label: `${p.codigo} — ${p.descricao}`,
      tipo: p.tipo,
      permiteRetencao: p.permiteRetencao,
    })),
    centroCusto: centroCusto.map((c) => ({ id: c.id, label: `${c.codigo} — ${c.descricao}` })),
    processoItens: processoItens.map((i) => ({ id: i.id, label: `${i.codigo} — ${i.descricao}`, processoId: i.processoId })),
    vendedores: vendedores.map((v) => ({ id: v.id, label: v.nome })),
    operadorasCartao: operadorasCartao.map((o) => ({ id: o.id, label: o.descricao })),
  };
}
