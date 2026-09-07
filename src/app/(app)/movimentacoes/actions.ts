"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  mensagemSaldoInsuficiente,
  registrarEntradaNaTransacao,
  registrarSaidaNaTransacao,
  registrarTransferenciaNaTransacao,
  SaldoInsuficienteError,
} from "@/lib/kardex";
import { normalizarTexto } from "@/lib/texto";

export type MovimentacaoFormState = { erro?: string };

const ENTRADA_TIPOS = new Set(["compra", "devolucao_cliente", "ajuste_entrada"]);
const SAIDA_TIPOS = new Set(["venda", "devolucao_fornecedor", "perda_avaria", "uso_interno", "ajuste_saida"]);

function parseItens<T extends z.ZodRawShape>(itemSchema: z.ZodObject<T>) {
  return z.string().transform((valor, ctx) => {
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(valor);
    } catch {
      ctx.addIssue({ code: "custom", message: "Itens inválidos." });
      return z.NEVER;
    }
    const resultado = z.array(itemSchema).min(1, "Adicione ao menos um item.").safeParse(parsedJson);
    if (!resultado.success) {
      ctx.addIssue({ code: "custom", message: resultado.error.issues[0]?.message ?? "Itens inválidos." });
      return z.NEVER;
    }
    return resultado.data;
  });
}

const transferenciaSchema = z.object({
  depositoOrigemId: z.string().min(1, "Selecione o depósito de origem."),
  depositoDestinoId: z.string().min(1, "Selecione o depósito de destino."),
  observacao: z.string().trim().transform(normalizarTexto).optional(),
  itens: parseItens(
    z.object({
      produtoId: z.string().min(1, "Selecione o produto."),
      quantidade: z.coerce.number().positive("Quantidade deve ser maior que zero."),
    })
  ),
});

const entradaSchema = z.object({
  depositoId: z.string().min(1, "Selecione o depósito."),
  fornecedorId: z.string().trim().optional(),
  observacao: z.string().trim().transform(normalizarTexto).optional(),
  itens: parseItens(
    z.object({
      produtoId: z.string().min(1, "Selecione o produto."),
      quantidade: z.coerce.number().positive("Quantidade deve ser maior que zero."),
      custoUnitario: z.coerce.number().nonnegative("Custo não pode ser negativo."),
    })
  ),
});

const saidaSchema = z.object({
  depositoId: z.string().min(1, "Selecione o depósito."),
  clienteId: z.string().trim().optional(),
  observacao: z.string().trim().transform(normalizarTexto).optional(),
  itens: parseItens(
    z.object({
      produtoId: z.string().min(1, "Selecione o produto."),
      quantidade: z.coerce.number().positive("Quantidade deve ser maior que zero."),
      precoVenda: z.coerce.number().nonnegative("Preço não pode ser negativo.").optional(),
    })
  ),
});

export async function registrarMovimento(
  _prev: MovimentacaoFormState,
  formData: FormData
): Promise<MovimentacaoFormState> {
  const session = await auth();
  if (!session?.user) return { erro: "Não autenticado." };
  const usuarioId = session.user.id;
  const perfil = session.user.perfil;

  const tipoMovimento = String(formData.get("tipoMovimento") ?? "");

  if (perfil === "vendedor" && tipoMovimento !== "venda") {
    return { erro: "Seu perfil só pode registrar vendas." };
  }

  try {
    if (tipoMovimento === "transferencia") {
      const parsed = transferenciaSchema.safeParse({
        depositoOrigemId: formData.get("depositoOrigemId"),
        depositoDestinoId: formData.get("depositoDestinoId"),
        observacao: formData.get("observacao"),
        itens: formData.get("itens"),
      });
      if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

      await db.$transaction(async (tx) => {
        for (const item of parsed.data.itens) {
          await registrarTransferenciaNaTransacao(tx, {
            produtoId: item.produtoId,
            depositoOrigemId: parsed.data.depositoOrigemId,
            depositoDestinoId: parsed.data.depositoDestinoId,
            quantidade: item.quantidade,
            usuarioId,
            observacao: parsed.data.observacao,
          });
        }
      });
    } else if (ENTRADA_TIPOS.has(tipoMovimento)) {
      const parsed = entradaSchema.safeParse({
        depositoId: formData.get("depositoId"),
        fornecedorId: formData.get("fornecedorId") || undefined,
        observacao: formData.get("observacao"),
        itens: formData.get("itens"),
      });
      if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

      await db.$transaction(async (tx) => {
        for (const item of parsed.data.itens) {
          await registrarEntradaNaTransacao(tx, {
            produtoId: item.produtoId,
            depositoId: parsed.data.depositoId,
            quantidade: item.quantidade,
            custoUnitario: item.custoUnitario,
            fornecedorId: parsed.data.fornecedorId || undefined,
            observacao: parsed.data.observacao,
            tipoMovimento: tipoMovimento as "compra" | "devolucao_cliente" | "ajuste_entrada",
            usuarioId,
          });
        }
      });
    } else if (SAIDA_TIPOS.has(tipoMovimento)) {
      const parsed = saidaSchema.safeParse({
        depositoId: formData.get("depositoId"),
        clienteId: formData.get("clienteId") || undefined,
        observacao: formData.get("observacao"),
        itens: formData.get("itens"),
      });
      if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

      await db.$transaction(async (tx) => {
        for (const item of parsed.data.itens) {
          await registrarSaidaNaTransacao(tx, {
            produtoId: item.produtoId,
            depositoId: parsed.data.depositoId,
            quantidade: item.quantidade,
            precoVenda: item.precoVenda,
            clienteId: parsed.data.clienteId || undefined,
            observacao: parsed.data.observacao,
            tipoMovimento: tipoMovimento as
              | "venda"
              | "devolucao_fornecedor"
              | "perda_avaria"
              | "uso_interno"
              | "ajuste_saida",
            usuarioId,
          });
        }
      });
    } else {
      return { erro: "Tipo de movimento inválido." };
    }
  } catch (error) {
    if (error instanceof SaldoInsuficienteError) return { erro: await mensagemSaldoInsuficiente(error) };
    if (error instanceof Error) return { erro: error.message };
    throw error;
  }

  revalidatePath("/estoque");
  redirect("/estoque?sucesso=1");
}
