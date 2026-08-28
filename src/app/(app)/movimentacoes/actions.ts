"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  registrarEntrada,
  registrarSaida,
  registrarTransferencia,
  SaldoInsuficienteError,
} from "@/lib/kardex";

export type MovimentacaoFormState = { erro?: string };

const ENTRADA_TIPOS = new Set(["compra", "devolucao_cliente", "ajuste_entrada"]);
const SAIDA_TIPOS = new Set(["venda", "devolucao_fornecedor", "perda_avaria", "uso_interno", "ajuste_saida"]);

const transferenciaSchema = z.object({
  produtoId: z.string().min(1, "Selecione o produto."),
  depositoOrigemId: z.string().min(1, "Selecione o depósito de origem."),
  depositoDestinoId: z.string().min(1, "Selecione o depósito de destino."),
  quantidade: z.coerce.number().positive("Quantidade deve ser maior que zero."),
  observacao: z.string().trim().optional(),
});

const entradaSchema = z.object({
  produtoId: z.string().min(1, "Selecione o produto."),
  depositoId: z.string().min(1, "Selecione o depósito."),
  quantidade: z.coerce.number().positive("Quantidade deve ser maior que zero."),
  custoUnitario: z.coerce.number().nonnegative("Custo não pode ser negativo."),
  fornecedorId: z.string().trim().optional(),
  observacao: z.string().trim().optional(),
});

const saidaSchema = z.object({
  produtoId: z.string().min(1, "Selecione o produto."),
  depositoId: z.string().min(1, "Selecione o depósito."),
  quantidade: z.coerce.number().positive("Quantidade deve ser maior que zero."),
  precoVenda: z.string().trim().optional(),
  clienteId: z.string().trim().optional(),
  observacao: z.string().trim().optional(),
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
        produtoId: formData.get("produtoId"),
        depositoOrigemId: formData.get("depositoOrigemId"),
        depositoDestinoId: formData.get("depositoDestinoId"),
        quantidade: formData.get("quantidade"),
        observacao: formData.get("observacao"),
      });
      if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

      await registrarTransferencia({ ...parsed.data, usuarioId });
    } else if (ENTRADA_TIPOS.has(tipoMovimento)) {
      const parsed = entradaSchema.safeParse({
        produtoId: formData.get("produtoId"),
        depositoId: formData.get("depositoId"),
        quantidade: formData.get("quantidade"),
        custoUnitario: formData.get("custoUnitario"),
        fornecedorId: formData.get("fornecedorId"),
        observacao: formData.get("observacao"),
      });
      if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

      await registrarEntrada({
        produtoId: parsed.data.produtoId,
        depositoId: parsed.data.depositoId,
        quantidade: parsed.data.quantidade,
        custoUnitario: parsed.data.custoUnitario,
        fornecedorId: parsed.data.fornecedorId || undefined,
        observacao: parsed.data.observacao,
        tipoMovimento: tipoMovimento as "compra" | "devolucao_cliente" | "ajuste_entrada",
        usuarioId,
      });
    } else if (SAIDA_TIPOS.has(tipoMovimento)) {
      const parsed = saidaSchema.safeParse({
        produtoId: formData.get("produtoId"),
        depositoId: formData.get("depositoId"),
        quantidade: formData.get("quantidade"),
        precoVenda: formData.get("precoVenda"),
        clienteId: formData.get("clienteId"),
        observacao: formData.get("observacao"),
      });
      if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

      await registrarSaida({
        produtoId: parsed.data.produtoId,
        depositoId: parsed.data.depositoId,
        quantidade: parsed.data.quantidade,
        precoVenda: parsed.data.precoVenda ? Number(parsed.data.precoVenda) : undefined,
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
    } else {
      return { erro: "Tipo de movimento inválido." };
    }
  } catch (error) {
    if (error instanceof SaldoInsuficienteError) return { erro: error.message };
    if (error instanceof Error) return { erro: error.message };
    throw error;
  }

  revalidatePath("/estoque");
  redirect("/estoque?sucesso=1");
}
