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
  principal: z.enum(["on"]).nullish(),
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
    principal: formData.get("principal"),
    itens: formData.get("itens"),
  });
}

export async function criarTabelaPreco(
  _prev: TabelaPrecoFormState,
  formData: FormData
): Promise<TabelaPrecoFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;
  const grupoId = permissao.session.user.grupoId!;

  const parsed = toData(formData);
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const principal = parsed.data.principal === "on";

  let tabela;
  try {
    tabela = await db.$transaction(async (tx) => {
      if (principal) await tx.tabelaPreco.updateMany({ where: { grupoId, principal: true }, data: { principal: false } });
      return tx.tabelaPreco.create({
        data: {
          nome: parsed.data.nome,
          ativo: parsed.data.ativo === "on",
          principal,
          grupoId,
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
  const grupoId = permissao.session.user.grupoId!;
  const principal = parsed.data.principal === "on";

  try {
    await db.$transaction(async (tx) => {
      const tabela = await tx.tabelaPreco.findFirst({
        where: { id, grupoId },
        select: { id: true },
      });
      if (!tabela) throw new Error("NAO_ENCONTRADA");

      if (principal) await tx.tabelaPreco.updateMany({ where: { grupoId, principal: true, id: { not: id } }, data: { principal: false } });

      await tx.itemTabelaPreco.deleteMany({ where: { tabelaPrecoId: id } });
      await tx.tabelaPreco.update({
        where: { id },
        data: {
          nome: parsed.data.nome,
          ativo: parsed.data.ativo === "on",
          principal,
          itens: {
            create: parsed.data.itens.map((i) => ({ produtoId: i.produtoId, preco: i.preco })),
          },
        },
      });
    });
  } catch (e) {
    if (e instanceof Error && e.message === "NAO_ENCONTRADA") return { erro: "Tabela de preço não encontrada." };
    return { erro: "Já existe uma tabela de preço com esse nome." };
  }

  revalidatePath("/tabela-precos");
  revalidatePath(`/tabela-precos/${id}`);
  redirect(`/tabela-precos/${id}`);
}
