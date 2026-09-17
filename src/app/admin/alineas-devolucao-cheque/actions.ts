"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarPlataforma } from "@/lib/permissions";

export type AlineaFormState = { erro?: string };

async function exigirMaster() {
  const session = await auth();
  if (!session?.user || !podeGerenciarPlataforma(session.user.perfil)) {
    throw new Error("Apenas o usuário master pode gerenciar Alíneas de Devolução.");
  }
  return session;
}

// Sem normalizarTexto aqui de propósito: código/descrição reproduzem a
// redação oficial do Bacen (acentos e caixa originais), não texto livre.
const schema = z.object({
  codigo: z.string().trim().min(1, "Informe o código."),
  descricao: z.string().trim().min(1, "Informe a descrição."),
});

export async function criarAlinea(_prev: AlineaFormState, formData: FormData): Promise<AlineaFormState> {
  await exigirMaster();

  const parsed = schema.safeParse({ codigo: formData.get("codigo"), descricao: formData.get("descricao") });
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  try {
    await db.alineaDevolucaoCheque.create({ data: parsed.data });
  } catch {
    return { erro: "Já existe uma alínea com esse código." };
  }

  revalidatePath("/admin/alineas-devolucao-cheque");
  redirect("/admin/alineas-devolucao-cheque");
}

export async function atualizarAlinea(
  id: string,
  _prev: AlineaFormState,
  formData: FormData
): Promise<AlineaFormState> {
  await exigirMaster();

  const parsed = schema.safeParse({ codigo: formData.get("codigo"), descricao: formData.get("descricao") });
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  try {
    const { count } = await db.alineaDevolucaoCheque.updateMany({ where: { id }, data: parsed.data });
    if (count === 0) return { erro: "Alínea não encontrada." };
  } catch {
    return { erro: "Já existe uma alínea com esse código." };
  }

  revalidatePath("/admin/alineas-devolucao-cheque");
  redirect("/admin/alineas-devolucao-cheque");
}

export async function alternarAtivoAlinea(id: string, ativo: boolean) {
  await exigirMaster();

  await db.alineaDevolucaoCheque.update({ where: { id }, data: { ativo } });
  revalidatePath("/admin/alineas-devolucao-cheque");
}
