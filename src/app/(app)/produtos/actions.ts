"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalizarTexto } from "@/lib/texto";

const schema = z.object({
  sku: z.string().trim().min(1, "Informe o SKU.").transform(normalizarTexto),
  nome: z.string().trim().min(1, "Informe o nome.").transform(normalizarTexto),
  categoriaId: z.string().trim().min(1, "Selecione a categoria."),
  marca: z.string().trim().transform(normalizarTexto).optional(),
  modelo: z.string().trim().transform(normalizarTexto).optional(),
  unidadeMedidaId: z.string().trim().min(1, "Selecione a unidade de medida."),
  fotoUrl: z.string().trim().optional(),
});

export type ProdutoFormState = { erro?: string };

async function exigirSessao() {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");
  return session;
}

function toData(formData: FormData) {
  return schema.safeParse({
    sku: formData.get("sku"),
    nome: formData.get("nome"),
    categoriaId: formData.get("categoriaId"),
    marca: formData.get("marca"),
    modelo: formData.get("modelo"),
    unidadeMedidaId: formData.get("unidadeMedidaId"),
    fotoUrl: formData.get("fotoUrl"),
  });
}

export async function criarProduto(_prev: ProdutoFormState, formData: FormData): Promise<ProdutoFormState> {
  await exigirSessao();
  const parsed = toData(formData);
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  try {
    await db.produto.create({
      data: {
        sku: parsed.data.sku,
        nome: parsed.data.nome,
        categoriaId: parsed.data.categoriaId,
        marca: parsed.data.marca || null,
        modelo: parsed.data.modelo || null,
        estadoConservacao: "bom",
        unidadeMedidaId: parsed.data.unidadeMedidaId,
        fotoUrl: parsed.data.fotoUrl || null,
      },
    });
  } catch {
    return { erro: "Já existe um produto com esse SKU." };
  }

  revalidatePath("/produtos");
  redirect("/produtos");
}

export async function atualizarProduto(
  id: string,
  _prev: ProdutoFormState,
  formData: FormData
): Promise<ProdutoFormState> {
  await exigirSessao();
  const parsed = toData(formData);
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  try {
    await db.produto.update({
      where: { id },
      data: {
        sku: parsed.data.sku,
        nome: parsed.data.nome,
        categoriaId: parsed.data.categoriaId,
        marca: parsed.data.marca || null,
        modelo: parsed.data.modelo || null,
        unidadeMedidaId: parsed.data.unidadeMedidaId,
        fotoUrl: parsed.data.fotoUrl || null,
      },
    });
  } catch {
    return { erro: "Já existe um produto com esse SKU." };
  }

  revalidatePath("/produtos");
  redirect("/produtos");
}
