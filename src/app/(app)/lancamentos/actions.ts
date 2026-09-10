"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  estornarLinhaDeMovimentoNaTransacao,
  mensagemSaldoInsuficiente,
  registrarEntradaNaTransacao,
  registrarSaidaNaTransacao,
  registrarTransferenciaNaTransacao,
  SaldoInsuficienteError,
} from "@/lib/kardex";
import { podeLancarMovimentacao } from "@/lib/permissions";
import { normalizarTexto } from "@/lib/texto";
import type { TipoLancamento } from "@/generated/prisma/client";

export type LancamentoFormState = { erro?: string };

const ENTRADA_TIPOS = new Set<TipoLancamento>(["compra", "devolucao_cliente", "ajuste_entrada"]);
const SAIDA_TIPOS = new Set<TipoLancamento>([
  "venda",
  "devolucao_fornecedor",
  "perda_avaria",
  "uso_interno",
  "ajuste_saida",
]);

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
  vendedorId: z.string().trim().optional(),
  observacao: z.string().trim().transform(normalizarTexto).optional(),
  itens: parseItens(
    z.object({
      produtoId: z.string().min(1, "Selecione o produto."),
      quantidade: z.coerce.number().positive("Quantidade deve ser maior que zero."),
      precoVenda: z.coerce.number().nonnegative("Preço não pode ser negativo.").optional(),
    })
  ),
});

async function exigirPermissao(tipo: string) {
  const session = await auth();
  if (!session?.user) return { erro: "Não autenticado." } as const;
  if (!podeLancarMovimentacao(session.user.perfil)) {
    return { erro: "Seu perfil não pode lançar movimentações." } as const;
  }
  if (session.user.perfil === "vendedor" && tipo !== "venda") {
    return { erro: "Seu perfil só pode lançar vendas." } as const;
  }
  return { session } as const;
}

function toItensCreate(tipo: TipoLancamento, itens: { produtoId: string; quantidade: number; custoUnitario?: number; precoVenda?: number }[]) {
  return itens.map((item) => ({
    produtoId: item.produtoId,
    quantidade: item.quantidade,
    custoUnitario: ENTRADA_TIPOS.has(tipo) ? item.custoUnitario : undefined,
    precoVenda: SAIDA_TIPOS.has(tipo) ? item.precoVenda : undefined,
  }));
}

export async function criarLancamento(_prev: LancamentoFormState, formData: FormData): Promise<LancamentoFormState> {
  const tipo = String(formData.get("tipo") ?? "") as TipoLancamento;
  const permissao = await exigirPermissao(tipo);
  if ("erro" in permissao) return permissao;
  const { session } = permissao;

  let lancamentoId: string;

  if (tipo === "transferencia") {
    const parsed = transferenciaSchema.safeParse({
      depositoOrigemId: formData.get("depositoOrigemId"),
      depositoDestinoId: formData.get("depositoDestinoId"),
      observacao: formData.get("observacao"),
      itens: formData.get("itens"),
    });
    if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

    const lancamento = await db.lancamento.create({
      data: {
        tipo,
        depositoOrigemId: parsed.data.depositoOrigemId,
        depositoDestinoId: parsed.data.depositoDestinoId,
        usuarioId: session.user.id,
        observacao: parsed.data.observacao || null,
        itens: { create: toItensCreate(tipo, parsed.data.itens) },
      },
    });
    lancamentoId = lancamento.id;
  } else if (ENTRADA_TIPOS.has(tipo)) {
    const parsed = entradaSchema.safeParse({
      depositoId: formData.get("depositoId"),
      fornecedorId: formData.get("fornecedorId") || undefined,
      observacao: formData.get("observacao"),
      itens: formData.get("itens"),
    });
    if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

    const lancamento = await db.lancamento.create({
      data: {
        tipo,
        depositoId: parsed.data.depositoId,
        fornecedorId: parsed.data.fornecedorId || null,
        usuarioId: session.user.id,
        observacao: parsed.data.observacao || null,
        itens: { create: toItensCreate(tipo, parsed.data.itens) },
      },
    });
    lancamentoId = lancamento.id;
  } else if (SAIDA_TIPOS.has(tipo)) {
    const parsed = saidaSchema.safeParse({
      depositoId: formData.get("depositoId"),
      clienteId: formData.get("clienteId") || undefined,
      vendedorId: formData.get("vendedorId") || undefined,
      observacao: formData.get("observacao"),
      itens: formData.get("itens"),
    });
    if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
    if (tipo === "venda" && !parsed.data.vendedorId) return { erro: "Selecione o vendedor." };

    const lancamento = await db.lancamento.create({
      data: {
        tipo,
        depositoId: parsed.data.depositoId,
        clienteId: parsed.data.clienteId || null,
        vendedorId: parsed.data.vendedorId || null,
        usuarioId: session.user.id,
        observacao: parsed.data.observacao || null,
        itens: { create: toItensCreate(tipo, parsed.data.itens) },
      },
    });
    lancamentoId = lancamento.id;
  } else {
    return { erro: "Tipo de lançamento inválido." };
  }

  revalidatePath("/lancamentos");
  redirect(`/lancamentos/${lancamentoId}`);
}

async function exigirLancamentoAberto(id: string) {
  const lancamento = await db.lancamento.findUnique({ where: { id } });
  if (!lancamento) return { erro: "Lançamento não encontrado." } as const;
  if (lancamento.status !== "aberto") return { erro: "Esse lançamento não está aberto." } as const;
  return { lancamento } as const;
}

export async function atualizarLancamento(
  id: string,
  _prev: LancamentoFormState,
  formData: FormData
): Promise<LancamentoFormState> {
  const tipo = String(formData.get("tipo") ?? "") as TipoLancamento;
  const permissao = await exigirPermissao(tipo);
  if ("erro" in permissao) return permissao;

  const atual = await exigirLancamentoAberto(id);
  if ("erro" in atual) return atual;
  if (atual.lancamento.tipo !== tipo) return { erro: "O tipo do lançamento não pode ser alterado." };

  let dadosHeader: Record<string, unknown>;
  let itensCreate: ReturnType<typeof toItensCreate>;

  if (tipo === "transferencia") {
    const parsed = transferenciaSchema.safeParse({
      depositoOrigemId: formData.get("depositoOrigemId"),
      depositoDestinoId: formData.get("depositoDestinoId"),
      observacao: formData.get("observacao"),
      itens: formData.get("itens"),
    });
    if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
    dadosHeader = {
      depositoOrigemId: parsed.data.depositoOrigemId,
      depositoDestinoId: parsed.data.depositoDestinoId,
      observacao: parsed.data.observacao || null,
    };
    itensCreate = toItensCreate(tipo, parsed.data.itens);
  } else if (ENTRADA_TIPOS.has(tipo)) {
    const parsed = entradaSchema.safeParse({
      depositoId: formData.get("depositoId"),
      fornecedorId: formData.get("fornecedorId") || undefined,
      observacao: formData.get("observacao"),
      itens: formData.get("itens"),
    });
    if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
    dadosHeader = {
      depositoId: parsed.data.depositoId,
      fornecedorId: parsed.data.fornecedorId || null,
      observacao: parsed.data.observacao || null,
    };
    itensCreate = toItensCreate(tipo, parsed.data.itens);
  } else if (SAIDA_TIPOS.has(tipo)) {
    const parsed = saidaSchema.safeParse({
      depositoId: formData.get("depositoId"),
      clienteId: formData.get("clienteId") || undefined,
      vendedorId: formData.get("vendedorId") || undefined,
      observacao: formData.get("observacao"),
      itens: formData.get("itens"),
    });
    if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
    if (tipo === "venda" && !parsed.data.vendedorId) return { erro: "Selecione o vendedor." };
    dadosHeader = {
      depositoId: parsed.data.depositoId,
      clienteId: parsed.data.clienteId || null,
      vendedorId: parsed.data.vendedorId || null,
      observacao: parsed.data.observacao || null,
    };
    itensCreate = toItensCreate(tipo, parsed.data.itens);
  } else {
    return { erro: "Tipo de lançamento inválido." };
  }

  await db.$transaction(async (tx) => {
    await tx.itemLancamento.deleteMany({ where: { lancamentoId: id } });
    await tx.lancamento.update({
      where: { id },
      data: { ...dadosHeader, itens: { create: itensCreate } },
    });
  });

  revalidatePath(`/lancamentos/${id}`);
  revalidatePath("/lancamentos");
  redirect(`/lancamentos/${id}`);
}

export async function excluirLancamento(
  id: string,
  _prev: LancamentoFormState,
  _formData: FormData
): Promise<LancamentoFormState> {
  const lancamento = await db.lancamento.findUnique({ where: { id } });
  if (!lancamento) return { erro: "Lançamento não encontrado." };
  const permissao = await exigirPermissao(lancamento.tipo);
  if ("erro" in permissao) return permissao;
  if (lancamento.status !== "aberto") return { erro: "Esse lançamento não está aberto." };

  await db.lancamento.delete({ where: { id } });

  revalidatePath("/lancamentos");
  redirect("/lancamentos");
}

export async function finalizarLancamento(
  id: string,
  _prev: LancamentoFormState,
  _formData: FormData
): Promise<LancamentoFormState> {
  const lancamento = await db.lancamento.findUnique({ where: { id } });
  if (!lancamento) return { erro: "Lançamento não encontrado." };
  const permissao = await exigirPermissao(lancamento.tipo);
  if ("erro" in permissao) return permissao;
  const { session } = permissao;

  try {
    await db.$transaction(async (tx) => {
      const atual = await tx.lancamento.findUniqueOrThrow({ where: { id }, include: { itens: true } });
      if (atual.status !== "aberto") throw new Error("Esse lançamento já foi finalizado.");

      const itensOrdenados = [...atual.itens].sort((a, b) => a.produtoId.localeCompare(b.produtoId));

      for (const item of itensOrdenados) {
        if (atual.tipo === "transferencia") {
          await registrarTransferenciaNaTransacao(tx, {
            produtoId: item.produtoId,
            depositoOrigemId: atual.depositoOrigemId!,
            depositoDestinoId: atual.depositoDestinoId!,
            quantidade: item.quantidade.toString(),
            usuarioId: session.user.id,
            observacao: atual.observacao ?? undefined,
            lancamentoId: atual.id,
          });
        } else if (ENTRADA_TIPOS.has(atual.tipo)) {
          await registrarEntradaNaTransacao(tx, {
            produtoId: item.produtoId,
            depositoId: atual.depositoId!,
            tipoMovimento: atual.tipo as "compra" | "devolucao_cliente" | "ajuste_entrada",
            quantidade: item.quantidade.toString(),
            custoUnitario: item.custoUnitario!.toString(),
            fornecedorId: atual.fornecedorId ?? undefined,
            usuarioId: session.user.id,
            observacao: atual.observacao ?? undefined,
            lancamentoId: atual.id,
          });
        } else {
          await registrarSaidaNaTransacao(tx, {
            produtoId: item.produtoId,
            depositoId: atual.depositoId!,
            tipoMovimento: atual.tipo as
              | "venda"
              | "devolucao_fornecedor"
              | "perda_avaria"
              | "uso_interno"
              | "ajuste_saida",
            quantidade: item.quantidade.toString(),
            precoVenda: item.precoVenda?.toString(),
            clienteId: atual.clienteId ?? undefined,
            vendedorId: atual.vendedorId ?? undefined,
            usuarioId: session.user.id,
            observacao: atual.observacao ?? undefined,
            lancamentoId: atual.id,
          });
        }
      }

      await tx.lancamento.update({ where: { id }, data: { status: "fechado", fechadoEm: new Date() } });
    });
  } catch (error) {
    if (error instanceof SaldoInsuficienteError) return { erro: await mensagemSaldoInsuficiente(error) };
    if (error instanceof Error) return { erro: error.message };
    throw error;
  }

  revalidatePath(`/lancamentos/${id}`);
  revalidatePath("/lancamentos");
  revalidatePath("/estoque");
  return {};
}

export async function cancelarFechamentoLancamento(
  id: string,
  _prev: LancamentoFormState,
  _formData: FormData
): Promise<LancamentoFormState> {
  const lancamento = await db.lancamento.findUnique({ where: { id } });
  if (!lancamento) return { erro: "Lançamento não encontrado." };
  const permissao = await exigirPermissao(lancamento.tipo);
  if ("erro" in permissao) return permissao;
  const { session } = permissao;

  if (lancamento.tipo === "transferencia") {
    return { erro: "Lançamentos de transferência não podem ser reabertos depois de fechados." };
  }

  try {
    await db.$transaction(async (tx) => {
      const atual = await tx.lancamento.findUniqueOrThrow({ where: { id } });
      if (atual.status !== "fechado") throw new Error("Esse lançamento não está fechado.");

      const movimentos = await tx.movimentacao.findMany({
        where: { lancamentoId: id, estornadoEm: null },
        orderBy: { produtoId: "asc" },
      });

      for (const movimento of movimentos) {
        await estornarLinhaDeMovimentoNaTransacao(
          tx,
          movimento,
          session.user.id,
          `Estorno do fechamento do Lançamento #${atual.numero}`
        );
      }

      await tx.lancamento.update({ where: { id }, data: { status: "aberto", reabertoEm: new Date() } });
    });
  } catch (error) {
    if (error instanceof SaldoInsuficienteError) return { erro: await mensagemSaldoInsuficiente(error) };
    if (error instanceof Error) return { erro: error.message };
    throw error;
  }

  revalidatePath(`/lancamentos/${id}`);
  revalidatePath("/lancamentos");
  revalidatePath("/estoque");
  return {};
}
