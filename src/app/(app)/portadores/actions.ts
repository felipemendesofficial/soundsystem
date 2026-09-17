"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { normalizarTexto } from "@/lib/texto";

export type PortadorFormState = { erro?: string };

const schema = z.object({
  nome: z.string().trim().min(1, "Informe o nome.").transform(normalizarTexto),
});

async function exigirPermissao() {
  const session = await auth();
  if (!session?.user) return { erro: "Não autenticado." } as const;
  if (!podeGerenciarFinanceiro(session.user.perfil)) {
    return { erro: "Seu perfil não pode gerenciar o Financeiro." } as const;
  }
  return { session } as const;
}

export async function criarPortador(_prev: PortadorFormState, formData: FormData): Promise<PortadorFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;

  const parsed = schema.safeParse({ nome: formData.get("nome") });
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  await db.portador.create({
    data: { nome: parsed.data.nome, empresaId: permissao.session.user.empresaId! },
  });

  revalidatePath("/portadores");
  redirect("/portadores");
}

export async function atualizarPortador(
  id: string,
  _prev: PortadorFormState,
  formData: FormData
): Promise<PortadorFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;

  const parsed = schema.safeParse({ nome: formData.get("nome") });
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const { count } = await db.portador.updateMany({
    where: { id, empresaId: permissao.session.user.empresaId! },
    data: { nome: parsed.data.nome },
  });
  if (count === 0) return { erro: "Portador não encontrado." };

  revalidatePath("/portadores");
  redirect("/portadores");
}

export async function alternarAtivoPortador(id: string, ativo: boolean) {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return;

  await db.portador.updateMany({ where: { id, empresaId: permissao.session.user.empresaId! }, data: { ativo } });
  revalidatePath("/portadores");
}
