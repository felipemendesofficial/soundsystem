"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarOrcamento } from "@/lib/permissions";
import {
  estornarEntradaNaTransacao,
  mensagemSaldoInsuficiente,
  registrarEntradaNaTransacao,
  SaldoInsuficienteError,
} from "@/lib/kardex";
import { calcularRateio } from "@/lib/orcamento";
import { normalizarTexto } from "@/lib/texto";

export type OrcamentoFormState = { erro?: string };

const itemSchema = z.object({
  produtoId: z.string().min(1, "Selecione o produto."),
  quantidade: z.coerce.number().positive("Quantidade deve ser maior que zero."),
  valorEstimadoVenda: z.coerce.number().nonnegative("Valor estimado de venda não pode ser negativo."),
});

const schema = z.object({
  descricao: z.string().trim().transform(normalizarTexto).optional(),
  depositoId: z.string().min(1, "Selecione o depósito."),
  fornecedorId: z.string().trim().optional(),
  itens: z.string().transform((valor, ctx) => {
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
  }),
});

async function exigirPermissao() {
  const session = await auth();
  if (!session?.user) return { erro: "Não autenticado." } as const;
  if (!podeGerenciarOrcamento(session.user.perfil)) {
    return { erro: "Seu perfil não pode gerenciar Orçamentos de Compra." } as const;
  }
  return { session } as const;
}

/**
 * `taxaRevenda` e `valorCompraTotalInformado` são alternativos (o formulário
 * só renderiza o campo do modo escolhido, então o outro nem chega no
 * FormData) — validados à mão em vez de via zod para não depender de como
 * cada versão do zod trata `null`/`""` em campos opcionais coagidos a número.
 */
function lerModoCalculo(formData: FormData): { taxaRevenda?: number; valorCompraTotalInformado?: number; erro?: string } {
  const modo = formData.get("modoCalculo") === "valor_total" ? "valor_total" : "taxa";

  if (modo === "taxa") {
    const bruto = formData.get("taxaRevenda");
    const taxaRevenda = Number(bruto);
    if (bruto === null || bruto === "" || !Number.isFinite(taxaRevenda) || taxaRevenda < 0 || taxaRevenda > 100) {
      return { erro: "Informe uma taxa de revenda válida, entre 0 e 100." };
    }
    return { taxaRevenda };
  }

  const bruto = formData.get("valorCompraTotalInformado");
  const valorCompraTotalInformado = Number(bruto);
  if (bruto === null || bruto === "" || !Number.isFinite(valorCompraTotalInformado) || valorCompraTotalInformado < 0) {
    return { erro: "Informe um valor total de compra válido." };
  }
  return { valorCompraTotalInformado };
}

function toData(formData: FormData) {
  return schema.safeParse({
    descricao: formData.get("descricao"),
    depositoId: formData.get("depositoId"),
    fornecedorId: formData.get("fornecedorId") || undefined,
    itens: formData.get("itens"),
  });
}

export async function criarOrcamento(_prev: OrcamentoFormState, formData: FormData): Promise<OrcamentoFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;

  const parsed = toData(formData);
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const modo = lerModoCalculo(formData);
  if (modo.erro) return { erro: modo.erro };

  const orcamento = await db.orcamento.create({
    data: {
      descricao: parsed.data.descricao || null,
      depositoId: parsed.data.depositoId,
      fornecedorId: parsed.data.fornecedorId || null,
      usuarioId: permissao.session.user.id,
      taxaRevenda: modo.taxaRevenda ?? null,
      valorCompraTotalInformado: modo.valorCompraTotalInformado ?? null,
      itens: {
        create: parsed.data.itens.map((i) => ({
          produtoId: i.produtoId,
          quantidade: i.quantidade,
          valorEstimadoVenda: i.valorEstimadoVenda,
        })),
      },
    },
  });

  revalidatePath("/orcamentos");
  redirect(`/orcamentos/${orcamento.id}`);
}

export async function atualizarOrcamento(
  id: string,
  _prev: OrcamentoFormState,
  formData: FormData
): Promise<OrcamentoFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;

  const atual = await db.orcamento.findUnique({ where: { id } });
  if (!atual) return { erro: "Orçamento não encontrado." };
  if (atual.status !== "aberto") return { erro: "Esse Orçamento está fechado e não pode mais ser editado." };

  const parsed = toData(formData);
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const modo = lerModoCalculo(formData);
  if (modo.erro) return { erro: modo.erro };

  await db.$transaction(async (tx) => {
    await tx.itemOrcamento.deleteMany({ where: { orcamentoId: id } });
    await tx.orcamento.update({
      where: { id },
      data: {
        descricao: parsed.data.descricao || null,
        depositoId: parsed.data.depositoId,
        fornecedorId: parsed.data.fornecedorId || null,
        taxaRevenda: modo.taxaRevenda ?? null,
        valorCompraTotalInformado: modo.valorCompraTotalInformado ?? null,
        itens: {
          create: parsed.data.itens.map((i) => ({
            produtoId: i.produtoId,
            quantidade: i.quantidade,
            valorEstimadoVenda: i.valorEstimadoVenda,
          })),
        },
      },
    });
  });

  revalidatePath("/orcamentos");
  redirect(`/orcamentos/${id}`);
}

/**
 * Fecha o Orçamento: calcula o rateio final (mesma lógica de src/lib/orcamento.ts
 * usada na prévia da tela), congela o custo de compra calculado em cada item e
 * lança uma entrada de `compra` no Kardex por item, tudo na mesma transação.
 */
export async function finalizarOrcamento(
  id: string,
  _prev: OrcamentoFormState,
  _formData: FormData
): Promise<OrcamentoFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;
  const { session } = permissao;

  try {
    await db.$transaction(async (tx) => {
      const orcamento = await tx.orcamento.findUnique({ where: { id }, include: { itens: true } });
      if (!orcamento) throw new Error("Orçamento não encontrado.");
      if (orcamento.status !== "aberto") throw new Error("Esse Orçamento já foi fechado.");
      if (orcamento.itens.length === 0) throw new Error("Adicione ao menos um item antes de finalizar.");

      const rateio = calcularRateio(
        orcamento.itens.map((i) => ({
          produtoId: i.produtoId,
          quantidade: i.quantidade,
          valorEstimadoVenda: i.valorEstimadoVenda,
        })),
        {
          taxaRevenda: orcamento.taxaRevenda,
          valorCompraTotalInformado: orcamento.valorCompraTotalInformado,
        }
      );

      const itensOrdenados = [...rateio.itens].sort((a, b) => a.produtoId.localeCompare(b.produtoId));

      for (const item of itensOrdenados) {
        const itemOriginal = orcamento.itens.find((i) => i.produtoId === item.produtoId)!;

        await registrarEntradaNaTransacao(tx, {
          produtoId: item.produtoId,
          depositoId: orcamento.depositoId,
          tipoMovimento: "compra",
          quantidade: item.quantidade,
          custoUnitario: item.custoCompraUnitario,
          fornecedorId: orcamento.fornecedorId ?? undefined,
          usuarioId: session.user.id,
          observacao: `Compra referente ao Orçamento #${orcamento.numero}`,
          orcamentoId: orcamento.id,
        });

        await tx.itemOrcamento.update({
          where: { id: itemOriginal.id },
          data: { custoCompraUnitario: item.custoCompraUnitario },
        });
      }

      await tx.orcamento.update({
        where: { id },
        data: { status: "fechado", fechadoEm: new Date() },
      });
    });
  } catch (error) {
    if (error instanceof SaldoInsuficienteError) return { erro: await mensagemSaldoInsuficiente(error) };
    if (error instanceof Error) return { erro: error.message };
    throw error;
  }

  revalidatePath(`/orcamentos/${id}`);
  revalidatePath("/orcamentos");
  revalidatePath("/estoque");
  return {};
}

/**
 * Cancela o fechamento: estorna exatamente as entradas de compra criadas em
 * `finalizarOrcamento` (via `estornarEntradaNaTransacao`, que desfaz o efeito
 * daquela entrada na média ponderada — não é uma saída comum) e volta o
 * Orçamento para aberto, pronto para ser editado e refechado.
 */
export async function cancelarFechamentoOrcamento(
  id: string,
  _prev: OrcamentoFormState,
  _formData: FormData
): Promise<OrcamentoFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;
  const { session } = permissao;

  try {
    await db.$transaction(async (tx) => {
      const orcamento = await tx.orcamento.findUnique({ where: { id }, include: { itens: true } });
      if (!orcamento) throw new Error("Orçamento não encontrado.");
      if (orcamento.status !== "fechado") throw new Error("Esse Orçamento não está fechado.");

      const itensOrdenados = [...orcamento.itens].sort((a, b) => a.produtoId.localeCompare(b.produtoId));

      for (const item of itensOrdenados) {
        if (item.custoCompraUnitario === null) continue;

        await estornarEntradaNaTransacao(tx, {
          produtoId: item.produtoId,
          depositoId: orcamento.depositoId,
          quantidade: item.quantidade,
          custoUnitarioOriginal: item.custoCompraUnitario,
          usuarioId: session.user.id,
          observacao: `Estorno (cancelamento) do fechamento do Orçamento #${orcamento.numero}`,
          orcamentoId: orcamento.id,
        });
      }

      await tx.orcamento.update({
        where: { id },
        data: { status: "aberto", reabertoEm: new Date() },
      });
    });
  } catch (error) {
    if (error instanceof SaldoInsuficienteError) {
      return {
        erro: `Não é possível cancelar: parte da quantidade comprada neste Orçamento já foi utilizada em outra movimentação (${await mensagemSaldoInsuficiente(error)}).`,
      };
    }
    if (error instanceof Error) return { erro: error.message };
    throw error;
  }

  revalidatePath(`/orcamentos/${id}`);
  revalidatePath("/orcamentos");
  revalidatePath("/estoque");
  return {};
}
