"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const schema = z.object({
  nome: z.string().trim().min(1, "Informe o nome."),
  tipoCliente: z.enum(["varejista", "atacadista"]),
  telefone: z.string().trim().optional(),
  email: z.union([z.literal(""), z.string().trim().email("Email inválido.")]).optional(),
});

export type ClienteFormState = { erro?: string };

async function exigirSessao() {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");
  return session;
}

function toData(formData: FormData) {
  return schema.safeParse({
    nome: formData.get("nome"),
    tipoCliente: formData.get("tipoCliente"),
    telefone: formData.get("telefone"),
    email: formData.get("email"),
  });
}

export async function criarCliente(_prev: ClienteFormState, formData: FormData): Promise<ClienteFormState> {
  await exigirSessao();
  const parsed = toData(formData);
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  await db.cliente.create({
    data: {
      nome: parsed.data.nome,
      tipoCliente: parsed.data.tipoCliente,
      telefone: parsed.data.telefone || null,
      email: parsed.data.email || null,
    },
  });

  revalidatePath("/clientes");
  redirect("/clientes");
}

export async function atualizarCliente(
  id: string,
  _prev: ClienteFormState,
  formData: FormData
): Promise<ClienteFormState> {
  await exigirSessao();
  const parsed = toData(formData);
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  await db.cliente.update({
    where: { id },
    data: {
      nome: parsed.data.nome,
      tipoCliente: parsed.data.tipoCliente,
      telefone: parsed.data.telefone || null,
      email: parsed.data.email || null,
    },
  });

  revalidatePath("/clientes");
  redirect("/clientes");
}
