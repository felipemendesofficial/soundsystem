"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const schema = z.object({
  nome: z.string().trim().min(1, "Informe o nome."),
});

export type UnidadeMedidaFormState = { erro?: string };

async function exigirSessao() {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");
  return session;
}

export async function criarUnidadeMedida(
  _prev: UnidadeMedidaFormState,
  formData: FormData
): Promise<UnidadeMedidaFormState> {
  await exigirSessao();
  const parsed = schema.safeParse({ nome: formData.get("nome") });
  if (!parsed.success) {
    return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    await db.unidadeMedida.create({ data: { nome: parsed.data.nome } });
  } catch {
    return { erro: "Já existe uma unidade de medida com esse nome." };
  }

  revalidatePath("/unidades-medida");
  redirect("/unidades-medida");
}

export async function atualizarUnidadeMedida(
  id: string,
  _prev: UnidadeMedidaFormState,
  formData: FormData
): Promise<UnidadeMedidaFormState> {
  await exigirSessao();
  const parsed = schema.safeParse({ nome: formData.get("nome") });
  if (!parsed.success) {
    return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    await db.unidadeMedida.update({ where: { id }, data: { nome: parsed.data.nome } });
  } catch {
    return { erro: "Já existe uma unidade de medida com esse nome." };
  }

  revalidatePath("/unidades-medida");
  redirect("/unidades-medida");
}
