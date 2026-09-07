"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalizarTexto } from "@/lib/texto";

const schema = z.object({
  nome: z.string().trim().min(1, "Informe o nome.").transform(normalizarTexto),
  endereco: z.string().trim().transform(normalizarTexto).optional(),
});

export type DepositoFormState = { erro?: string };

async function exigirSessao() {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");
  return session;
}

export async function criarDeposito(
  _prev: DepositoFormState,
  formData: FormData
): Promise<DepositoFormState> {
  await exigirSessao();
  const parsed = schema.safeParse({
    nome: formData.get("nome"),
    endereco: formData.get("endereco"),
  });
  if (!parsed.success) {
    return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  await db.deposito.create({
    data: { nome: parsed.data.nome, endereco: parsed.data.endereco || null },
  });

  revalidatePath("/depositos");
  redirect("/depositos");
}

export async function atualizarDeposito(
  id: string,
  _prev: DepositoFormState,
  formData: FormData
): Promise<DepositoFormState> {
  await exigirSessao();
  const parsed = schema.safeParse({
    nome: formData.get("nome"),
    endereco: formData.get("endereco"),
  });
  if (!parsed.success) {
    return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  await db.deposito.update({
    where: { id },
    data: { nome: parsed.data.nome, endereco: parsed.data.endereco || null },
  });

  revalidatePath("/depositos");
  redirect("/depositos");
}

export async function alternarAtivoDeposito(id: string, ativo: boolean) {
  await exigirSessao();
  await db.deposito.update({ where: { id }, data: { ativo } });
  revalidatePath("/depositos");
}
