"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalizarTexto } from "@/lib/texto";

const schema = z.object({
  nome: z.string().trim().min(1, "Informe o nome.").transform(normalizarTexto),
  tipoPessoa: z.enum(["fisica", "juridica"]),
  documento: z.string().trim().transform(normalizarTexto).optional(),
  telefone: z.string().trim().transform(normalizarTexto).optional(),
  email: z.union([z.literal(""), z.string().trim().email("Email inválido.")]).optional(),
});

export type FornecedorFormState = { erro?: string };

async function exigirSessao() {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");
  return session;
}

function toData(formData: FormData) {
  return schema.safeParse({
    nome: formData.get("nome"),
    tipoPessoa: formData.get("tipoPessoa"),
    documento: formData.get("documento"),
    telefone: formData.get("telefone"),
    email: formData.get("email"),
  });
}

export async function criarFornecedor(
  _prev: FornecedorFormState,
  formData: FormData
): Promise<FornecedorFormState> {
  await exigirSessao();
  const parsed = toData(formData);
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  await db.fornecedor.create({
    data: {
      nome: parsed.data.nome,
      tipoPessoa: parsed.data.tipoPessoa,
      documento: parsed.data.documento || null,
      telefone: parsed.data.telefone || null,
      email: parsed.data.email || null,
    },
  });

  revalidatePath("/fornecedores");
  redirect("/fornecedores");
}

export async function atualizarFornecedor(
  id: string,
  _prev: FornecedorFormState,
  formData: FormData
): Promise<FornecedorFormState> {
  await exigirSessao();
  const parsed = toData(formData);
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  await db.fornecedor.update({
    where: { id },
    data: {
      nome: parsed.data.nome,
      tipoPessoa: parsed.data.tipoPessoa,
      documento: parsed.data.documento || null,
      telefone: parsed.data.telefone || null,
      email: parsed.data.email || null,
    },
  });

  revalidatePath("/fornecedores");
  redirect("/fornecedores");
}
