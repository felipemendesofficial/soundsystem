"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { normalizarTexto } from "@/lib/texto";

/**
 * O único índice único de Produto é `[grupoId, sku]` — então um P2002 aqui
 * sempre é mesmo SKU duplicado. Qualquer outro erro (ex.: P2003, FK de
 * categoriaId/unidadeMedidaId inválida — pode acontecer com uma página
 * restaurada do cache do navegador, algo mais comum no celular) NÃO é SKU
 * duplicado; mostrar essa mensagem errada só confunde quem tá tentando
 * corrigir o problema de verdade.
 */
function erroAoSalvarProduto(error: unknown): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return "Já existe um produto com esse SKU.";
    if (error.code === "P2003") return "Categoria ou Unidade de Medida inválida — atualize a página e tente novamente.";
  }
  return "Não foi possível salvar o produto. Tente novamente.";
}

const schema = z.object({
  sku: z.string().trim().min(1, "Informe o SKU.").transform(normalizarTexto),
  nome: z.string().trim().min(1, "Informe o nome.").transform(normalizarTexto),
  categoriaId: z.string().trim().min(1, "Selecione a categoria."),
  marca: z.string().trim().transform(normalizarTexto).optional(),
  modelo: z.string().trim().transform(normalizarTexto).optional(),
  unidadeMedidaId: z.string().trim().min(1, "Selecione a unidade de medida."),
  fotoUrl: z.string().trim().optional(),
  controlaEstoque: z.enum(["on"]).nullish(),
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
    controlaEstoque: formData.get("controlaEstoque"),
  });
}

export async function criarProduto(_prev: ProdutoFormState, formData: FormData): Promise<ProdutoFormState> {
  const session = await exigirSessao();
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
        controlaEstoque: parsed.data.controlaEstoque === "on",
        grupoId: session.user.grupoId!,
      },
    });
  } catch (error) {
    return { erro: erroAoSalvarProduto(error) };
  }

  revalidatePath("/produtos");
  redirect("/produtos");
}

export async function atualizarProduto(
  id: string,
  _prev: ProdutoFormState,
  formData: FormData
): Promise<ProdutoFormState> {
  const session = await exigirSessao();
  const parsed = toData(formData);
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  try {
    const { count } = await db.produto.updateMany({
      where: { id, grupoId: session.user.grupoId! },
      data: {
        sku: parsed.data.sku,
        nome: parsed.data.nome,
        categoriaId: parsed.data.categoriaId,
        marca: parsed.data.marca || null,
        modelo: parsed.data.modelo || null,
        unidadeMedidaId: parsed.data.unidadeMedidaId,
        fotoUrl: parsed.data.fotoUrl || null,
        controlaEstoque: parsed.data.controlaEstoque === "on",
      },
    });
    if (count === 0) return { erro: "Produto não encontrado." };
  } catch (error) {
    return { erro: erroAoSalvarProduto(error) };
  }

  revalidatePath("/produtos");
  redirect("/produtos");
}
