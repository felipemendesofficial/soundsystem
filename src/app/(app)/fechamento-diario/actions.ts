"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { fecharDia, reabrirDia } from "@/lib/financeiro-ledger";

export type FechamentoFormState = { erro?: string };

async function exigirPermissao() {
  const session = await auth();
  if (!session?.user) return { erro: "Não autenticado." } as const;
  if (!podeGerenciarFinanceiro(session.user.perfil)) {
    return { erro: "Seu perfil não pode gerenciar o Financeiro." } as const;
  }
  return { session } as const;
}

export async function fecharDiaAction(_prev: FechamentoFormState): Promise<FechamentoFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;

  try {
    await db.$transaction((tx) => fecharDia(tx, permissao.session.user.empresaId!, permissao.session.user.id));
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Não foi possível fechar o dia." };
  }

  revalidatePath("/fechamento-diario");
  return {};
}

export async function reabrirDiaAction(_prev: FechamentoFormState): Promise<FechamentoFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;

  try {
    await reabrirDia(db, permissao.session.user.empresaId!, permissao.session.user.id);
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Não foi possível reabrir o dia." };
  }

  revalidatePath("/fechamento-diario");
  return {};
}
