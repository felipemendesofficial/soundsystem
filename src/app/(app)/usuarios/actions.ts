"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarUsuarios } from "@/lib/permissions";
import { normalizarTexto } from "@/lib/texto";

export type UsuarioFormState = { erro?: string };

async function exigirAdmin() {
  const session = await auth();
  if (!session?.user || !podeGerenciarUsuarios(session.user.perfil)) {
    throw new Error("Apenas administradores podem gerenciar usuários.");
  }
  return session;
}

const baseSchema = {
  nome: z.string().trim().min(1, "Informe o nome.").transform(normalizarTexto),
  email: z.string().trim().email("Email inválido."),
  perfil: z.enum(["admin", "estoquista", "vendedor"]),
  depositoPadraoId: z.string().trim().optional(),
  ativo: z.literal("on").nullish(),
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
  const session = await exigirAdmin();

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
    // Cria o usuário no grupo do admin e já dá acesso à empresa ativa dele —
    // acesso a outras empresas do grupo é concedido depois, editando o
    // usuário (ver atualizarUsuario / UsuarioEmpresa).
    await db.$transaction(async (tx) => {
      const usuario = await tx.usuario.create({
        data: {
          nome: parsed.data.nome,
          email: parsed.data.email,
          senhaHash: await bcrypt.hash(parsed.data.senha, 10),
          perfil: parsed.data.perfil,
          ativo: parsed.data.ativo === "on",
          grupoId: session.user.grupoId!,
        },
      });
      await tx.usuarioEmpresa.create({
        data: {
          usuarioId: usuario.id,
          empresaId: session.user.empresaId!,
          depositoPadraoId: parsed.data.depositoPadraoId || null,
        },
      });
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
  const session = await exigirAdmin();

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
    await db.$transaction(async (tx) => {
      const { count } = await tx.usuario.updateMany({
        where: { id, grupoId: session.user.grupoId! },
        data: {
          nome: parsed.data.nome,
          email: parsed.data.email,
          perfil: parsed.data.perfil,
          ativo: parsed.data.ativo === "on",
          ...(parsed.data.senha ? { senhaHash: await bcrypt.hash(parsed.data.senha, 10) } : {}),
        },
      });
      if (count === 0) throw new Error("NAO_ENCONTRADO");

      await tx.usuarioEmpresa.upsert({
        where: { usuarioId_empresaId: { usuarioId: id, empresaId: session.user.empresaId! } },
        update: { depositoPadraoId: parsed.data.depositoPadraoId || null },
        create: {
          usuarioId: id,
          empresaId: session.user.empresaId!,
          depositoPadraoId: parsed.data.depositoPadraoId || null,
        },
      });
    });
  } catch (e) {
    if (e instanceof Error && e.message === "NAO_ENCONTRADO") return { erro: "Usuário não encontrado." };
    return { erro: "Já existe um usuário com esse email." };
  }

  revalidatePath("/usuarios");
  redirect("/usuarios");
}
