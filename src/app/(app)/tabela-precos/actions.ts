"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarTabelaPreco } from "@/lib/permissions";
import { normalizarTexto } from "@/lib/texto";

export type TabelaPrecoFormState = { erro?: string };

const itemSchema = z.object({
  produtoId: z.string().min(1),
  preco: z.coerce.number().nonnegative("Preço não pode ser negativo."),
});

const schema = z.object({
  nome: z.string().trim().min(1, "Informe o nome.").transform(normalizarTexto),
  ativo: z.enum(["on"]).nullish(),
  itens: z.string().transform((valor, ctx) => {
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(valor);
    } catch {
      ctx.addIssue({ code: "custom", message: "Itens inválidos." });
      return z.NEVER;
    }
    const resultado = z.array(itemSchema).safeParse(parsedJson);
    if (!resultado.success) {
      ctx.addIssue({ code: "custom", message: "Itens inválidos." });
      return z.NEVER;
    }
    return resultado.data;
  }),
});

async function exigirPermissao() {
  const session = await auth();
  if (!session?.user) return { erro: "Não autenticado." } as const;
  if (!podeGerenciarTabelaPreco(session.user.perfil)) {
    return { erro: "Seu perfil não pode gerenciar Tabelas de Preço." } as const;
  }
  return { session } as const;
}

function toData(formData: FormData) {
  return schema.safeParse({
    nome: formData.get("nome"),
    ativo: formData.get("ativo"),
    itens: formData.get("itens"),
  });
}

export async function criarTabelaPreco(
  _prev: TabelaPrecoFormState,
  formData: FormData
): Promise<TabelaPrecoFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;

  const parsed = toData(formData);
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  let tabela;
  try {
    tabela = await db.tabelaPreco.create({
      data: {
        nome: parsed.data.nome,
        ativo: parsed.data.ativo === "on",
        itens: {
          create: parsed.data.itens.map((i) => ({ produtoId: i.produtoId, preco: i.preco })),
        },
      },
    });
  } catch {
    return { erro: "Já existe uma tabela de preço com esse nome." };
  }

  revalidatePath("/tabela-precos");
  redirect(`/tabela-precos/${tabela.id}`);
}

export async function atualizarTabelaPreco(
  id: string,
  _prev: TabelaPrecoFormState,
  formData: FormData
): Promise<TabelaPrecoFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;

  const parsed = toData(formData);
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  try {
    await db.$transaction(async (tx) => {
      await tx.itemTabelaPreco.deleteMany({ where: { tabelaPrecoId: id } });
      await tx.tabelaPreco.update({
        where: { id },
        data: {
          nome: parsed.data.nome,
          ativo: parsed.data.ativo === "on",
          itens: {
            create: parsed.data.itens.map((i) => ({ produtoId: i.produtoId, preco: i.preco })),
          },
        },
      });
    });
  } catch {
    return { erro: "Já existe uma tabela de preço com esse nome." };
  }

  revalidatePath("/tabela-precos");
  revalidatePath(`/tabela-precos/${id}`);
  redirect(`/tabela-precos/${id}`);
}
