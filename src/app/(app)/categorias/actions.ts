"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const schema = z.object({
  nome: z.string().trim().min(1, "Informe o nome."),
});

export type CategoriaFormState = { erro?: string };

async function exigirSessao() {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");
  return session;
}

export async function criarCategoria(
  _prev: CategoriaFormState,
  formData: FormData
): Promise<CategoriaFormState> {
  await exigirSessao();
  const parsed = schema.safeParse({ nome: formData.get("nome") });
  if (!parsed.success) {
    return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    await db.categoria.create({ data: { nome: parsed.data.nome } });
  } catch {
    return { erro: "Já existe uma categoria com esse nome." };
  }

  revalidatePath("/categorias");
  redirect("/categorias");
}

export async function atualizarCategoria(
  id: string,
  _prev: CategoriaFormState,
  formData: FormData
): Promise<CategoriaFormState> {
  await exigirSessao();
  const parsed = schema.safeParse({ nome: formData.get("nome") });
  if (!parsed.success) {
    return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    await db.categoria.update({ where: { id }, data: { nome: parsed.data.nome } });
  } catch {
    return { erro: "Já existe uma categoria com esse nome." };
  }

  revalidatePath("/categorias");
  redirect("/categorias");
}
