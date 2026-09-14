"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalizarTexto } from "@/lib/texto";

const schema = z.object({
  nome: z.string().trim().min(1, "Informe o nome.").transform(normalizarTexto),
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
  const session = await exigirSessao();
  const parsed = schema.safeParse({ nome: formData.get("nome") });
  if (!parsed.success) {
    return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    await db.unidadeMedida.create({ data: { nome: parsed.data.nome, grupoId: session.user.grupoId! } });
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
  const session = await exigirSessao();
  const parsed = schema.safeParse({ nome: formData.get("nome") });
  if (!parsed.success) {
    return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    const { count } = await db.unidadeMedida.updateMany({
      where: { id, grupoId: session.user.grupoId! },
      data: { nome: parsed.data.nome },
    });
    if (count === 0) return { erro: "Unidade de medida não encontrada." };
  } catch {
    return { erro: "Já existe uma unidade de medida com esse nome." };
  }

  revalidatePath("/unidades-medida");
  redirect("/unidades-medida");
}
