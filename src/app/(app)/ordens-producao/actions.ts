"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { podeLancarMovimentacao } from "@/lib/permissions";
import {
  resolverTenantPorDepositoValidado,
  registrarSaidaNaTransacao,
  registrarEntradaNaTransacao,
  estornarLinhaDeMovimentoNaTransacao,
  mensagemSaldoInsuficiente,
  SaldoInsuficienteError,
} from "@/lib/kardex";

export type OrdemProducaoFormState = { erro?: string };

async function exigirPermissao() {
  const session = await auth();
  if (!session?.user) return { erro: "Não autenticado." } as const;
  if (!podeLancarMovimentacao(session.user.perfil)) {
    return { erro: "Seu perfil não pode lançar movimentações de estoque." } as const;
  }
  return { session } as const;
}

function parseJsonArray<T extends z.ZodRawShape>(itemSchema: z.ZodObject<T>, opts: { label: string }) {
  return z.string().transform((valor, ctx) => {
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(valor);
    } catch {
      ctx.addIssue({ code: "custom", message: `${opts.label} inválido(s).` });
      return z.NEVER;
    }
    const resultado = z.array(itemSchema).safeParse(parsedJson);
    if (!resultado.success) {
      ctx.addIssue({ code: "custom", message: resultado.error.issues[0]?.message ?? `${opts.label} inválido(s).` });
      return z.NEVER;
    }
    return resultado.data;
  });
}

const materialSchema = z.object({
  produtoId: z.string().min(1),
  depositoId: z.string().min(1),
  quantidade: z.coerce.number().positive(),
});
const servicoSchema = z.object({
  servicoId: z.string().min(1),
  valor: z.coerce.number().nonnegative(),
});

const ordemProducaoSchema = z.object({
  depositoEntradaId: z.string().min(1, "Selecione o depósito de entrada."),
  produtoFinalId: z.string().min(1, "Selecione o produto final."),
  quantidadeEntrada: z.coerce.number().positive("Quantidade de entrada deve ser maior que zero."),
  materiais: parseJsonArray(materialSchema, { label: "Materiais" }),
  servicos: parseJsonArray(servicoSchema, { label: "Serviços" }),
});

type DadosOrdemProducao = z.infer<typeof ordemProducaoSchema>;

/** Parse + validação compartilhados entre criar/atualizar — tudo que não depende de a Ordem já existir. */
async function lerEValidar(
  formData: FormData,
  ctx: { empresaId: string; grupoId: string }
): Promise<{ dados: DadosOrdemProducao } | { erro: string }> {
  const { empresaId, grupoId } = ctx;

  const parsed = ordemProducaoSchema.safeParse({
    depositoEntradaId: formData.get("depositoEntradaId"),
    produtoFinalId: formData.get("produtoFinalId"),
    quantidadeEntrada: formData.get("quantidadeEntrada"),
    materiais: formData.get("materiais"),
    servicos: formData.get("servicos"),
  });
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const dados = parsed.data;

  if (dados.materiais.length === 0 && dados.servicos.length === 0) {
    return { erro: "Adicione ao menos um material ou serviço." };
  }

  const tenantEntrada = await resolverTenantPorDepositoValidado(db, dados.depositoEntradaId, empresaId);
  if (!tenantEntrada) return { erro: "Depósito de entrada inválido." };

  for (const material of dados.materiais) {
    const tenantMaterial = await resolverTenantPorDepositoValidado(db, material.depositoId, empresaId);
    if (!tenantMaterial) return { erro: "Um ou mais depósitos de material são inválidos." };
  }

  const produtoFinal = await db.produto.findFirst({ where: { id: dados.produtoFinalId, grupoId } });
  if (!produtoFinal) return { erro: "Produto final não encontrado." };

  if (dados.materiais.length > 0) {
    const produtoIds = dados.materiais.map((m) => m.produtoId);
    const produtosValidos = await db.produto.count({ where: { id: { in: produtoIds }, grupoId } });
    if (produtosValidos !== new Set(produtoIds).size) return { erro: "Um ou mais produtos de material são inválidos." };
  }

  if (dados.servicos.length > 0) {
    const servicoIds = dados.servicos.map((s) => s.servicoId);
    const servicosValidos = await db.servico.count({ where: { id: { in: servicoIds }, grupoId } });
    if (servicosValidos !== new Set(servicoIds).size) return { erro: "Um ou mais serviços são inválidos." };
  }

  return { dados };
}

export async function criarOrdemProducao(_prev: OrdemProducaoFormState, formData: FormData): Promise<OrdemProducaoFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;
  const empresaId = permissao.session.user.empresaId!;
  const grupoId = permissao.session.user.grupoId!;

  const validado = await lerEValidar(formData, { empresaId, grupoId });
  if ("erro" in validado) return validado;
  const { dados } = validado;

  const ordem = await db.ordemProducao.create({
    data: {
      empresaId,
      depositoEntradaId: dados.depositoEntradaId,
      produtoFinalId: dados.produtoFinalId,
      quantidadeEntrada: new Prisma.Decimal(dados.quantidadeEntrada),
      usuarioId: permissao.session.user.id,
      materiais: {
        create: dados.materiais.map((m) => ({
          produtoId: m.produtoId,
          depositoId: m.depositoId,
          quantidade: new Prisma.Decimal(m.quantidade),
        })),
      },
      servicos: {
        create: dados.servicos.map((s) => ({ servicoId: s.servicoId, valor: new Prisma.Decimal(s.valor) })),
      },
    },
  });

  revalidatePath("/ordens-producao");
  redirect(`/ordens-producao/${ordem.id}`);
}

/** Só permitida enquanto `aberta` — nenhum estoque foi movimentado ainda, então materiais/serviços podem ser recriados do zero. */
export async function atualizarOrdemProducao(
  id: string,
  _prev: OrdemProducaoFormState,
  formData: FormData
): Promise<OrdemProducaoFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;
  const empresaId = permissao.session.user.empresaId!;
  const grupoId = permissao.session.user.grupoId!;

  const atual = await db.ordemProducao.findFirst({ where: { id, empresaId } });
  if (!atual) return { erro: "Ordem de Produção não encontrada." };
  if (atual.status !== "aberta") return { erro: "Só é possível editar uma Ordem de Produção em aberto." };

  const validado = await lerEValidar(formData, { empresaId, grupoId });
  if ("erro" in validado) return validado;
  const { dados } = validado;

  await db.$transaction(async (tx) => {
    await tx.ordemProducaoMaterial.deleteMany({ where: { ordemProducaoId: id } });
    await tx.ordemProducaoServico.deleteMany({ where: { ordemProducaoId: id } });
    await tx.ordemProducao.update({
      where: { id },
      data: {
        depositoEntradaId: dados.depositoEntradaId,
        produtoFinalId: dados.produtoFinalId,
        quantidadeEntrada: new Prisma.Decimal(dados.quantidadeEntrada),
        materiais: {
          create: dados.materiais.map((m) => ({
            produtoId: m.produtoId,
            depositoId: m.depositoId,
            quantidade: new Prisma.Decimal(m.quantidade),
          })),
        },
        servicos: {
          create: dados.servicos.map((s) => ({ servicoId: s.servicoId, valor: new Prisma.Decimal(s.valor) })),
        },
      },
    });
  });

  revalidatePath("/ordens-producao");
  revalidatePath(`/ordens-producao/${id}`);
  redirect(`/ordens-producao/${id}`);
}

/** Nunca apaga de verdade — só marca `cancelada`, pra continuar consultável no histórico. Só permitida em aberto (nenhum estoque foi movimentado ainda). */
export async function cancelarOrdemProducao(id: string): Promise<OrdemProducaoFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;
  const empresaId = permissao.session.user.empresaId!;

  const ordem = await db.ordemProducao.findFirst({ where: { id, empresaId } });
  if (!ordem) return { erro: "Ordem de Produção não encontrada." };
  if (ordem.status !== "aberta") return { erro: "Só é possível cancelar uma Ordem de Produção em aberto." };

  await db.ordemProducao.update({ where: { id }, data: { status: "cancelada" } });
  revalidatePath("/ordens-producao");
  revalidatePath(`/ordens-producao/${id}`);
  return {};
}

/**
 * Processa a OP: uma saída (`op_saida`) por material, no depósito daquela
 * linha, congelando `custoUnitarioDebitado` (= custo médio no momento do
 * débito, devolvido por `registrarSaidaNaTransacao`); soma esse custo mais o
 * de serviços; recalcula `custoUnitarioFinal` e registra a entrada
 * (`op_entrada`) do produto final no `depositoEntradaId`, que recalcula a
 * média ponderada normalmente. Mesmo padrão "congela ao fechar" de
 * Orçamento/Lancamento.
 */
export async function processarOrdemProducao(id: string): Promise<OrdemProducaoFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;
  const empresaId = permissao.session.user.empresaId!;
  const usuarioId = permissao.session.user.id;

  const ordem = await db.ordemProducao.findFirst({
    where: { id, empresaId },
    include: { materiais: true, servicos: true },
  });
  if (!ordem) return { erro: "Ordem de Produção não encontrada." };
  if (ordem.status !== "aberta") return { erro: "Esta Ordem de Produção já foi processada." };

  try {
    await db.$transaction(async (tx) => {
      let custoTotal = new Prisma.Decimal(0);

      for (const material of ordem.materiais) {
        const movimentacao = await registrarSaidaNaTransacao(tx, {
          produtoId: material.produtoId,
          depositoId: material.depositoId,
          tipoMovimento: "op_saida",
          quantidade: material.quantidade.toString(),
          usuarioId,
          ordemProducaoId: ordem.id,
        });
        await tx.ordemProducaoMaterial.update({
          where: { id: material.id },
          data: { custoUnitarioDebitado: movimentacao.custoMedioApos, movimentacaoId: movimentacao.id },
        });
        custoTotal = custoTotal.plus(material.quantidade.times(movimentacao.custoMedioApos));
      }

      for (const servico of ordem.servicos) {
        custoTotal = custoTotal.plus(servico.valor);
      }

      const custoUnitarioFinal = custoTotal.dividedBy(ordem.quantidadeEntrada);

      const movimentacaoEntrada = await registrarEntradaNaTransacao(tx, {
        produtoId: ordem.produtoFinalId,
        depositoId: ordem.depositoEntradaId,
        tipoMovimento: "op_entrada",
        quantidade: ordem.quantidadeEntrada,
        custoUnitario: custoUnitarioFinal,
        usuarioId,
        ordemProducaoId: ordem.id,
      });

      await tx.ordemProducao.update({
        where: { id: ordem.id },
        data: {
          status: "processada",
          custoUnitarioFinal,
          movimentacaoEntradaId: movimentacaoEntrada.id,
          processadoEm: new Date(),
        },
      });
    });
  } catch (e) {
    if (e instanceof SaldoInsuficienteError) return { erro: await mensagemSaldoInsuficiente(e) };
    return { erro: e instanceof Error ? e.message : "Não foi possível processar a Ordem de Produção." };
  }

  revalidatePath("/ordens-producao");
  revalidatePath(`/ordens-producao/${id}`);
  return {};
}

/** Reverte o processamento: estorna a entrada do produto final e a saída de cada material, cada uma exatamente como aconteceu. Volta pra `aberta`. */
export async function estornarProcessamentoOrdemProducao(id: string): Promise<OrdemProducaoFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;
  const empresaId = permissao.session.user.empresaId!;
  const usuarioId = permissao.session.user.id;

  const ordem = await db.ordemProducao.findFirst({
    where: { id, empresaId },
    include: { materiais: true },
  });
  if (!ordem) return { erro: "Ordem de Produção não encontrada." };
  if (ordem.status !== "processada") return { erro: "Esta Ordem de Produção não está processada." };

  try {
    await db.$transaction(async (tx) => {
      if (ordem.movimentacaoEntradaId) {
        const movimentacaoEntrada = await tx.movimentacao.findUniqueOrThrow({ where: { id: ordem.movimentacaoEntradaId } });
        await estornarLinhaDeMovimentoNaTransacao(tx, movimentacaoEntrada, usuarioId);
      }

      for (const material of ordem.materiais) {
        if (!material.movimentacaoId) continue;
        const movimentacaoMaterial = await tx.movimentacao.findUniqueOrThrow({ where: { id: material.movimentacaoId } });
        await estornarLinhaDeMovimentoNaTransacao(tx, movimentacaoMaterial, usuarioId);
        await tx.ordemProducaoMaterial.update({
          where: { id: material.id },
          data: { custoUnitarioDebitado: null, movimentacaoId: null },
        });
      }

      await tx.ordemProducao.update({
        where: { id: ordem.id },
        data: { status: "aberta", custoUnitarioFinal: null, movimentacaoEntradaId: null, processadoEm: null },
      });
    });
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Não foi possível estornar o processamento." };
  }

  revalidatePath("/ordens-producao");
  revalidatePath(`/ordens-producao/${id}`);
  return {};
}
