import type { Perfil } from "@/generated/prisma/client";

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
