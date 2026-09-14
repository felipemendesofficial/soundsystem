"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarPlataforma } from "@/lib/permissions";
import { normalizarTexto } from "@/lib/texto";

export type GrupoFormState = { erro?: string };

async function exigirMaster() {
  const session = await auth();
  if (!session?.user || !podeGerenciarPlataforma(session.user.perfil)) {
    throw new Error("Apenas o usuário master pode gerenciar grupos.");
  }
  return session;
}

const criarGrupoSchema = z.object({
  grupoNome: z.string().trim().min(1, "Informe o nome do grupo.").transform(normalizarTexto),
  empresaNome: z.string().trim().min(1, "Informe o nome da empresa.").transform(normalizarTexto),
  empresaCnpj: z.string().trim().optional(),
  adminNome: z.string().trim().min(1, "Informe o nome do administrador.").transform(normalizarTexto),
  adminEmail: z.string().trim().email("Email inválido."),
  adminSenha: z.string().min(6, "A senha deve ter ao menos 6 caracteres."),
});

/**
 * Cria Grupo + Empresa + o primeiro usuário admin daquele grupo, tudo numa
 * transação só — sem isso o grupo ficaria criado sem ninguém capaz de logar
 * nele (decisão registrada em multi-tenant-grupo-empresa.md).
 */
export async function criarGrupo(_prev: GrupoFormState, formData: FormData): Promise<GrupoFormState> {
  await exigirMaster();

  const parsed = criarGrupoSchema.safeParse({
    grupoNome: formData.get("grupoNome"),
    empresaNome: formData.get("empresaNome"),
    empresaCnpj: formData.get("empresaCnpj"),
    adminNome: formData.get("adminNome"),
    adminEmail: formData.get("adminEmail"),
    adminSenha: formData.get("adminSenha"),
  });
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  try {
    await db.$transaction(async (tx) => {
      const grupo = await tx.grupoEmpresarial.create({ data: { nome: parsed.data.grupoNome } });
      const empresa = await tx.empresa.create({
        data: { grupoId: grupo.id, nome: parsed.data.empresaNome, cnpj: parsed.data.empresaCnpj || null },
      });
      const admin = await tx.usuario.create({
        data: {
          nome: parsed.data.adminNome,
          email: parsed.data.adminEmail,
          senhaHash: await bcrypt.hash(parsed.data.adminSenha, 10),
          perfil: "admin",
          grupoId: grupo.id,
        },
      });
      await tx.usuarioEmpresa.create({ data: { usuarioId: admin.id, empresaId: empresa.id } });
    });
  } catch {
    return { erro: "Já existe um usuário com esse email." };
  }

  revalidatePath("/admin/grupos");
  redirect("/admin/grupos");
}

const adicionarEmpresaSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome da empresa.").transform(normalizarTexto),
  cnpj: z.string().trim().optional(),
});

export async function adicionarEmpresa(
  grupoId: string,
  _prev: GrupoFormState,
  formData: FormData
): Promise<GrupoFormState> {
  await exigirMaster();

  const parsed = adicionarEmpresaSchema.safeParse({
    nome: formData.get("nome"),
    cnpj: formData.get("cnpj"),
  });
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  await db.empresa.create({ data: { grupoId, nome: parsed.data.nome, cnpj: parsed.data.cnpj || null } });

  revalidatePath(`/admin/grupos/${grupoId}`);
  redirect(`/admin/grupos/${grupoId}`);
}

export async function alternarAtivoEmpresa(grupoId: string, empresaId: string, novoAtivo: boolean) {
  await exigirMaster();

  await db.empresa.update({ where: { id: empresaId }, data: { ativo: novoAtivo } });

  revalidatePath(`/admin/grupos/${grupoId}`);
  revalidatePath("/admin/grupos");
}
