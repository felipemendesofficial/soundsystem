import type { Perfil } from "@/generated/prisma/client";

/**
 * Master é o admin da plataforma (sem grupo) — cria Grupos/Empresas na área
 * /admin. Nenhum outro perfil acessa essa área, e master não acessa mais nada.
 */
export function podeGerenciarPlataforma(perfil: Perfil): boolean {
  return perfil === "master";
}

export function podeVerCusto(perfil: Perfil): boolean {
  return perfil === "admin" || perfil === "estoquista";
}

export function podeGerenciarUsuarios(perfil: Perfil): boolean {
  return perfil === "admin";
}

export function podeLancarMovimentacao(perfil: Perfil): boolean {
  return perfil === "admin" || perfil === "estoquista" || perfil === "vendedor";
}

/**
 * Orçamentos de compra lidam com custo/preço de compra dos produtos — a
 * mesma fronteira de `podeVerCusto` (o perfil vendedor nunca vê custo/margem).
 */
export function podeGerenciarOrcamento(perfil: Perfil): boolean {
  return perfil === "admin" || perfil === "estoquista";
}

/**
 * Gerenciar tabelas de preço envolve ver a margem (preço vs. custo médio) —
 * mesma fronteira de `podeVerCusto`. O preço sugerido em si (sem margem)
 * continua disponível para o vendedor dentro do formulário de venda.
 */
export function podeGerenciarTabelaPreco(perfil: Perfil): boolean {
  return perfil === "admin" || perfil === "estoquista";
}

/**
 * Cadastro de Vendedor (comissão) é dado sensível — mesma fronteira de
 * `podeVerCusto`. Indicar um vendedor já cadastrado numa venda/OS continua
 * liberado para qualquer perfil que possa lançar movimentação.
 */
export function podeGerenciarVendedor(perfil: Perfil): boolean {
  return perfil === "admin" || perfil === "estoquista";
}

/**
 * Módulo financeiro (contas bancárias, plano de contas, lançamentos) —
 * mesma fronteira de `podeGerenciarUsuarios`: configuração sensível,
 * admin-only, nem o perfil estoquista mexe aqui.
 */
export function podeGerenciarFinanceiro(perfil: Perfil): boolean {
  return perfil === "admin";
}
