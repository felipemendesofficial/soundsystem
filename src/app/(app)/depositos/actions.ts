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
  const session = await exigirSessao();
  const parsed = schema.safeParse({
    nome: formData.get("nome"),
    endereco: formData.get("endereco"),
  });
  if (!parsed.success) {
    return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  await db.deposito.create({
    data: { nome: parsed.data.nome, endereco: parsed.data.endereco || null, empresaId: session.user.empresaId! },
  });

  revalidatePath("/depositos");
  redirect("/depositos");
}

export async function atualizarDeposito(
  id: string,
  _prev: DepositoFormState,
  formData: FormData
): Promise<DepositoFormState> {
  const session = await exigirSessao();
  const parsed = schema.safeParse({
    nome: formData.get("nome"),
    endereco: formData.get("endereco"),
  });
  if (!parsed.success) {
    return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { count } = await db.deposito.updateMany({
    where: { id, empresaId: session.user.empresaId! },
    data: { nome: parsed.data.nome, endereco: parsed.data.endereco || null },
  });
  if (count === 0) return { erro: "Depósito não encontrado." };

  revalidatePath("/depositos");
  redirect("/depositos");
}

export async function alternarAtivoDeposito(id: string, ativo: boolean) {
  const session = await exigirSessao();
  await db.deposito.updateMany({ where: { id, empresaId: session.user.empresaId! }, data: { ativo } });
  revalidatePath("/depositos");
}
