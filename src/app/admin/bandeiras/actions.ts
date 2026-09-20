"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarPlataforma } from "@/lib/permissions";

export type BandeiraFormState = { erro?: string };

async function exigirMaster() {
  const session = await auth();
  if (!session?.user || !podeGerenciarPlataforma(session.user.perfil)) {
    throw new Error("Apenas o usuário master pode gerenciar Bandeiras.");
  }
  return session;
}

const schema = z.object({
  nome: z.string().trim().min(1, "Informe o nome."),
});

export async function criarBandeira(_prev: BandeiraFormState, formData: FormData): Promise<BandeiraFormState> {
  await exigirMaster();

  const parsed = schema.safeParse({ nome: formData.get("nome") });
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  try {
    await db.bandeira.create({ data: parsed.data });
  } catch {
    return { erro: "Já existe uma bandeira com esse nome." };
  }

  revalidatePath("/admin/bandeiras");
  redirect("/admin/bandeiras");
}

export async function atualizarBandeira(
  id: string,
  _prev: BandeiraFormState,
  formData: FormData
): Promise<BandeiraFormState> {
  await exigirMaster();

  const parsed = schema.safeParse({ nome: formData.get("nome") });
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  try {
    const { count } = await db.bandeira.updateMany({ where: { id }, data: parsed.data });
    if (count === 0) return { erro: "Bandeira não encontrada." };
  } catch {
    return { erro: "Já existe uma bandeira com esse nome." };
  }

  revalidatePath("/admin/bandeiras");
  redirect("/admin/bandeiras");
}

export async function alternarAtivoBandeira(id: string, ativo: boolean) {
  await exigirMaster();

  await db.bandeira.update({ where: { id }, data: { ativo } });
  revalidatePath("/admin/bandeiras");
}
