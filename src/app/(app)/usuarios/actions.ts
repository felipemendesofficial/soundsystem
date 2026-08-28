"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarUsuarios } from "@/lib/permissions";

export type UsuarioFormState = { erro?: string };

async function exigirAdmin() {
  const session = await auth();
  if (!session?.user || !podeGerenciarUsuarios(session.user.perfil)) {
    throw new Error("Apenas administradores podem gerenciar usuários.");
  }
  return session;
}

const baseSchema = {
  nome: z.string().trim().min(1, "Informe o nome."),
  email: z.string().trim().email("Email inválido."),
  perfil: z.enum(["admin", "estoquista", "vendedor"]),
  depositoPadraoId: z.string().trim().optional(),
  ativo: z.literal("on").optional(),
};

const criarSchema = z.object({
  ...baseSchema,
  senha: z.string().min(6, "A senha deve ter ao menos 6 caracteres."),
});

const atualizarSchema = z.object({
  ...baseSchema,
  senha: z.union([z.literal(""), z.string().min(6, "A senha deve ter ao menos 6 caracteres.")]).optional(),
});

export async function criarUsuario(_prev: UsuarioFormState, formData: FormData): Promise<UsuarioFormState> {
  await exigirAdmin();

  const parsed = criarSchema.safeParse({
    nome: formData.get("nome"),
    email: formData.get("email"),
    perfil: formData.get("perfil"),
    depositoPadraoId: formData.get("depositoPadraoId"),
    ativo: formData.get("ativo"),
    senha: formData.get("senha"),
  });
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  try {
    await db.usuario.create({
      data: {
        nome: parsed.data.nome,
        email: parsed.data.email,
        senhaHash: await bcrypt.hash(parsed.data.senha, 10),
        perfil: parsed.data.perfil,
        depositoPadraoId: parsed.data.depositoPadraoId || null,
        ativo: parsed.data.ativo === "on",
      },
    });
  } catch {
    return { erro: "Já existe um usuário com esse email." };
  }

  revalidatePath("/usuarios");
  redirect("/usuarios");
}

export async function atualizarUsuario(
  id: string,
  _prev: UsuarioFormState,
  formData: FormData
): Promise<UsuarioFormState> {
  await exigirAdmin();

  const parsed = atualizarSchema.safeParse({
    nome: formData.get("nome"),
    email: formData.get("email"),
    perfil: formData.get("perfil"),
    depositoPadraoId: formData.get("depositoPadraoId"),
    ativo: formData.get("ativo"),
    senha: formData.get("senha"),
  });
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  try {
    await db.usuario.update({
      where: { id },
      data: {
        nome: parsed.data.nome,
        email: parsed.data.email,
        perfil: parsed.data.perfil,
        depositoPadraoId: parsed.data.depositoPadraoId || null,
        ativo: parsed.data.ativo === "on",
        ...(parsed.data.senha ? { senhaHash: await bcrypt.hash(parsed.data.senha, 10) } : {}),
      },
    });
  } catch {
    return { erro: "Já existe um usuário com esse email." };
  }

  revalidatePath("/usuarios");
  redirect("/usuarios");
}
