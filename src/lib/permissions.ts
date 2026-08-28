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
