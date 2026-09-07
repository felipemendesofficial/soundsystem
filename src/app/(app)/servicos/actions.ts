"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalizarTexto } from "@/lib/texto";

const schema = z.object({
  nome: z.string().trim().min(1, "Informe o nome.").transform(normalizarTexto),
  precoPadrao: z.coerce.number().nonnegative("Preço não pode ser negativo."),
});

export type ServicoFormState = { erro?: string };

async function exigirSessao() {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");
  return session;
}

function toData(formData: FormData) {
  return schema.safeParse({
    nome: formData.get("nome"),
    precoPadrao: formData.get("precoPadrao"),
  });
}

export async function criarServico(
  _prev: ServicoFormState,
  formData: FormData
): Promise<ServicoFormState> {
  await exigirSessao();
  const parsed = toData(formData);
  if (!parsed.success) {
    return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    await db.servico.create({
      data: { nome: parsed.data.nome, precoPadrao: parsed.data.precoPadrao },
    });
  } catch {
    return { erro: "Já existe um serviço com esse nome." };
  }

  revalidatePath("/servicos");
  redirect("/servicos");
}

export async function atualizarServico(
  id: string,
  _prev: ServicoFormState,
  formData: FormData
): Promise<ServicoFormState> {
  await exigirSessao();
  const parsed = toData(formData);
  if (!parsed.success) {
    return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    await db.servico.update({
      where: { id },
      data: { nome: parsed.data.nome, precoPadrao: parsed.data.precoPadrao },
    });
  } catch {
    return { erro: "Já existe um serviço com esse nome." };
  }

  revalidatePath("/servicos");
  redirect("/servicos");
}
