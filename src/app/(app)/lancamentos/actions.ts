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
  resolverTenantPorDepositoValidado,
  SaldoInsuficienteError,
} from "@/lib/kardex";
import { podeLancarMovimentacao } from "@/lib/permissions";
import { normalizarTexto } from "@/lib/texto";
import { calcularAjusteTotal } from "@/lib/ajuste-total";
import { Prisma, type TipoLancamento } from "@/generated/prisma/client";

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
  documento: z.string().trim().optional(),
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
  clienteId: z.string().trim().optional(),
  documento: z.string().trim().optional(),
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
  fornecedorId: z.string().trim().optional(),
  vendedorId: z.string().trim().optional(),
  documento: z.string().trim().optional(),
  observacao: z.string().trim().transform(normalizarTexto).optional(),
  modoAjuste: z.enum(["nenhum", "desconto", "acrescimo"]),
  formatoAjuste: z.enum(["percentual", "valor"]),
  valorAjuste: z.coerce.number().nonnegative(),
  itens: parseItens(
    z.object({
      produtoId: z.string().min(1, "Selecione o produto."),
      quantidade: z.coerce.number().positive("Quantidade deve ser maior que zero."),
      precoOriginal: z.coerce.number().nonnegative("Preço não pode ser negativo.").optional(),
    })
  ),
});

/**
 * Recalcula o precoVenda líquido de cada item de saída a partir do
 * precoOriginal (nunca tocado pelo desconto) + a configuração de ajuste —
 * nunca confiamos num preço final computado no client. Pra tipos de saída
 * sem desconto (tudo exceto venda), modoAjuste vem sempre "nenhum" do form,
 * o que faz calcularAjusteTotal devolver o próprio precoOriginal sem alterar
 * nada — seguro rodar incondicionalmente.
 */
function calcularItensSaidaComPrecoLiquido(dados: z.infer<typeof saidaSchema>) {
  const resultadoAjuste = calcularAjusteTotal(
    dados.itens.map((i) => ({ quantidade: i.quantidade, precoDeclarado: i.precoOriginal ?? 0 })),
    { modo: dados.modoAjuste, formato: dados.formatoAjuste, valor: dados.valorAjuste }
  );

  return dados.itens.map((item, idx) => ({
    ...item,
    precoVenda: item.precoOriginal !== undefined ? resultadoAjuste.precosFinais[idx] : undefined,
  }));
}

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

// Só pra entrada/transferência — saída usa calcularItensSaidaComPrecoLiquido,
// que já resolve precoOriginal/precoVenda direto.
function toItensCreate(tipo: TipoLancamento, itens: { produtoId: string; quantidade: number; custoUnitario?: number }[]) {
  return itens.map((item) => ({
    produtoId: item.produtoId,
    quantidade: item.quantidade,
    custoUnitario: ENTRADA_TIPOS.has(tipo) ? item.custoUnitario : undefined,
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
      documento: formData.get("documento") || undefined,
      observacao: formData.get("observacao"),
      itens: formData.get("itens"),
    });
    if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

    const tenant = await resolverTenantPorDepositoValidado(db, parsed.data.depositoOrigemId, session.user.empresaId!);
    if (!tenant) return { erro: "Depósito de origem não encontrado." };
    const destino = await db.deposito.findFirst({
      where: { id: parsed.data.depositoDestinoId, empresaId: session.user.empresaId! },
    });
    if (!destino) return { erro: "Depósito de destino não encontrado." };
    const { empresaId, grupoId } = tenant;
    const lancamento = await db.lancamento.create({
      data: {
        tipo,
        depositoOrigemId: parsed.data.depositoOrigemId,
        depositoDestinoId: parsed.data.depositoDestinoId,
        empresaId,
        grupoId,
        usuarioId: session.user.id,
        documento: parsed.data.documento || null,
        observacao: parsed.data.observacao || null,
        itens: { create: toItensCreate(tipo, parsed.data.itens) },
      },
    });
    lancamentoId = lancamento.id;
  } else if (ENTRADA_TIPOS.has(tipo)) {
    const parsed = entradaSchema.safeParse({
      depositoId: formData.get("depositoId"),
      fornecedorId: formData.get("fornecedorId") || undefined,
      clienteId: formData.get("clienteId") || undefined,
      documento: formData.get("documento") || undefined,
      observacao: formData.get("observacao"),
      itens: formData.get("itens"),
    });
    if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

    const tenant = await resolverTenantPorDepositoValidado(db, parsed.data.depositoId, session.user.empresaId!);
    if (!tenant) return { erro: "Depósito não encontrado." };
    const { empresaId, grupoId } = tenant;
    const lancamento = await db.lancamento.create({
      data: {
        tipo,
        depositoId: parsed.data.depositoId,
        empresaId,
        grupoId,
        // devolucao_cliente é a única entrada com contraparte cliente (não
        // fornecedor) — precisa ir pro CreditoDevolucao gerado ao fechar.
        fornecedorId: tipo === "devolucao_cliente" ? null : parsed.data.fornecedorId || null,
        clienteId: tipo === "devolucao_cliente" ? parsed.data.clienteId || null : null,
        usuarioId: session.user.id,
        documento: parsed.data.documento || null,
        observacao: parsed.data.observacao || null,
        itens: { create: toItensCreate(tipo, parsed.data.itens) },
      },
    });
    lancamentoId = lancamento.id;
  } else if (SAIDA_TIPOS.has(tipo)) {
    const parsed = saidaSchema.safeParse({
      depositoId: formData.get("depositoId"),
      clienteId: formData.get("clienteId") || undefined,
      fornecedorId: formData.get("fornecedorId") || undefined,
      vendedorId: formData.get("vendedorId") || undefined,
      documento: formData.get("documento") || undefined,
      observacao: formData.get("observacao"),
      modoAjuste: formData.get("modoAjuste"),
      formatoAjuste: formData.get("formatoAjuste"),
      valorAjuste: formData.get("valorAjuste"),
      itens: formData.get("itens"),
    });
    if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
    if (tipo === "venda" && !parsed.data.vendedorId) return { erro: "Selecione o vendedor." };

    const tenant = await resolverTenantPorDepositoValidado(db, parsed.data.depositoId, session.user.empresaId!);
    if (!tenant) return { erro: "Depósito não encontrado." };
    const { empresaId, grupoId } = tenant;
    const lancamento = await db.lancamento.create({
      data: {
        tipo,
        depositoId: parsed.data.depositoId,
        empresaId,
        grupoId,
        // devolucao_fornecedor é a única saída com contraparte fornecedor
        // (não cliente) — precisa ir pro CreditoDevolucao gerado ao fechar.
        clienteId: tipo === "devolucao_fornecedor" ? null : parsed.data.clienteId || null,
        fornecedorId: tipo === "devolucao_fornecedor" ? parsed.data.fornecedorId || null : null,
        vendedorId: parsed.data.vendedorId || null,
        usuarioId: session.user.id,
        documento: parsed.data.documento || null,
        observacao: parsed.data.observacao || null,
        modoAjuste: parsed.data.modoAjuste,
        formatoAjuste: parsed.data.formatoAjuste,
        valorAjuste: parsed.data.valorAjuste,
        itens: { create: calcularItensSaidaComPrecoLiquido(parsed.data) },
      },
    });
    lancamentoId = lancamento.id;
  } else {
    return { erro: "Tipo de lançamento inválido." };
  }

  revalidatePath("/lancamentos");
  redirect(`/lancamentos/${lancamentoId}`);
}

async function exigirLancamentoAberto(id: string, empresaId: string) {
  const lancamento = await db.lancamento.findFirst({ where: { id, empresaId } });
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
  const { session } = permissao;

  const atual = await exigirLancamentoAberto(id, session.user.empresaId!);
  if ("erro" in atual) return atual;
  if (atual.lancamento.tipo !== tipo) return { erro: "O tipo do lançamento não pode ser alterado." };

  let dadosHeader: Record<string, unknown>;
  let itensCreate: ReturnType<typeof toItensCreate> | ReturnType<typeof calcularItensSaidaComPrecoLiquido>;

  if (tipo === "transferencia") {
    const parsed = transferenciaSchema.safeParse({
      depositoOrigemId: formData.get("depositoOrigemId"),
      depositoDestinoId: formData.get("depositoDestinoId"),
      documento: formData.get("documento") || undefined,
      observacao: formData.get("observacao"),
      itens: formData.get("itens"),
    });
    if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
    const tenant = await resolverTenantPorDepositoValidado(db, parsed.data.depositoOrigemId, session.user.empresaId!);
    if (!tenant) return { erro: "Depósito de origem não encontrado." };
    const destino = await db.deposito.findFirst({
      where: { id: parsed.data.depositoDestinoId, empresaId: session.user.empresaId! },
    });
    if (!destino) return { erro: "Depósito de destino não encontrado." };
    const { empresaId, grupoId } = tenant;
    dadosHeader = {
      depositoOrigemId: parsed.data.depositoOrigemId,
      depositoDestinoId: parsed.data.depositoDestinoId,
      empresaId,
      grupoId,
      documento: parsed.data.documento || null,
      observacao: parsed.data.observacao || null,
    };
    itensCreate = toItensCreate(tipo, parsed.data.itens);
  } else if (ENTRADA_TIPOS.has(tipo)) {
    const parsed = entradaSchema.safeParse({
      depositoId: formData.get("depositoId"),
      fornecedorId: formData.get("fornecedorId") || undefined,
      clienteId: formData.get("clienteId") || undefined,
      documento: formData.get("documento") || undefined,
      observacao: formData.get("observacao"),
      itens: formData.get("itens"),
    });
    if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
    const tenant = await resolverTenantPorDepositoValidado(db, parsed.data.depositoId, session.user.empresaId!);
    if (!tenant) return { erro: "Depósito não encontrado." };
    const { empresaId, grupoId } = tenant;
    dadosHeader = {
      depositoId: parsed.data.depositoId,
      empresaId,
      grupoId,
      fornecedorId: tipo === "devolucao_cliente" ? null : parsed.data.fornecedorId || null,
      clienteId: tipo === "devolucao_cliente" ? parsed.data.clienteId || null : null,
      documento: parsed.data.documento || null,
      observacao: parsed.data.observacao || null,
    };
    itensCreate = toItensCreate(tipo, parsed.data.itens);
  } else if (SAIDA_TIPOS.has(tipo)) {
    const parsed = saidaSchema.safeParse({
      depositoId: formData.get("depositoId"),
      clienteId: formData.get("clienteId") || undefined,
      fornecedorId: formData.get("fornecedorId") || undefined,
      vendedorId: formData.get("vendedorId") || undefined,
      documento: formData.get("documento") || undefined,
      observacao: formData.get("observacao"),
      modoAjuste: formData.get("modoAjuste"),
      formatoAjuste: formData.get("formatoAjuste"),
      valorAjuste: formData.get("valorAjuste"),
      itens: formData.get("itens"),
    });
    if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
    if (tipo === "venda" && !parsed.data.vendedorId) return { erro: "Selecione o vendedor." };
    const tenant = await resolverTenantPorDepositoValidado(db, parsed.data.depositoId, session.user.empresaId!);
    if (!tenant) return { erro: "Depósito não encontrado." };
    const { empresaId, grupoId } = tenant;
    dadosHeader = {
      depositoId: parsed.data.depositoId,
      empresaId,
      grupoId,
      clienteId: tipo === "devolucao_fornecedor" ? null : parsed.data.clienteId || null,
      fornecedorId: tipo === "devolucao_fornecedor" ? parsed.data.fornecedorId || null : null,
      vendedorId: parsed.data.vendedorId || null,
      documento: parsed.data.documento || null,
      observacao: parsed.data.observacao || null,
      modoAjuste: parsed.data.modoAjuste,
      formatoAjuste: parsed.data.formatoAjuste,
      valorAjuste: parsed.data.valorAjuste,
    };
    itensCreate = calcularItensSaidaComPrecoLiquido(parsed.data);
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
  const session = await auth();
  if (!session?.user) return { erro: "Não autenticado." };
  const lancamento = await db.lancamento.findFirst({ where: { id, empresaId: session.user.empresaId! } });
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
  const sessaoAtual = await auth();
  if (!sessaoAtual?.user) return { erro: "Não autenticado." };
  const lancamento = await db.lancamento.findFirst({ where: { id, empresaId: sessaoAtual.user.empresaId! } });
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

      // Devolução (compra ou venda) gera crédito de devolução automaticamente,
      // valorizado pelas Movimentacao que ESTE lançamento acabou de gravar
      // (nunca re-derivado do ItemLancamento — evita divergir do que o
      // Kardex já considerou definitivo). Cada devolução tem seu próprio
      // saldo, nunca agregado num pote por fornecedor/cliente (ver
      // CreditoDevolucao) — pode ser usado parcialmente numa Renegociação.
      if (atual.tipo === "devolucao_fornecedor" || atual.tipo === "devolucao_cliente") {
        const geradas = await tx.movimentacao.findMany({ where: { lancamentoId: atual.id } });
        const valorTotal = geradas.reduce((acc, m) => {
          // devolucao_cliente é ENTRADA: custoUnitario é o valor digitado pro
          // Kardex. devolucao_fornecedor é SAÍDA: nunca tem custoUnitario
          // próprio (saída sempre debita ao custo médio vigente), então usa
          // custoMedioApos — exatamente o valor que essa saída debitou.
          const valorUnitario = atual.tipo === "devolucao_cliente" ? m.custoUnitario : m.custoMedioApos;
          return acc.plus(m.quantidade.times(valorUnitario ?? new Prisma.Decimal(0)));
        }, new Prisma.Decimal(0));

        if (valorTotal.greaterThan(0)) {
          await tx.creditoDevolucao.create({
            data: {
              empresaId: atual.empresaId,
              lancamentoId: atual.id,
              fornecedorId: atual.tipo === "devolucao_fornecedor" ? atual.fornecedorId : null,
              clienteId: atual.tipo === "devolucao_cliente" ? atual.clienteId : null,
              valorOriginal: valorTotal,
              saldoDisponivel: valorTotal,
            },
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
  const sessaoAtual = await auth();
  if (!sessaoAtual?.user) return { erro: "Não autenticado." };
  const lancamento = await db.lancamento.findFirst({ where: { id, empresaId: sessaoAtual.user.empresaId! } });
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
