"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { normalizarTexto } from "@/lib/texto";

export type ConciliacaoFormState = { erro?: string };

async function exigirPermissao() {
  const session = await auth();
  if (!session?.user) return { erro: "Não autenticado." } as const;
  if (!podeGerenciarFinanceiro(session.user.perfil)) {
    return { erro: "Seu perfil não pode gerenciar o Financeiro." } as const;
  }
  return { session } as const;
}

const linhaSchema = z.object({
  data: z.coerce.date({ message: "Informe a data." }),
  descricao: z.string().trim().min(1, "Informe a descrição.").transform(normalizarTexto),
  valor: z.coerce.number().refine((v) => v !== 0, "Valor não pode ser zero."),
});

/** Lança manualmente uma linha do extrato bancário real — base pra conciliar contra o ledger do sistema. */
export async function criarLinhaExtrato(
  contaId: string,
  _prev: ConciliacaoFormState,
  formData: FormData
): Promise<ConciliacaoFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;
  const empresaId = permissao.session.user.empresaId!;

  const conta = await db.contaFinanceira.findFirst({ where: { id: contaId, empresaId } });
  if (!conta) return { erro: "Conta financeira não encontrada." };

  const parsed = linhaSchema.safeParse({
    data: formData.get("data"),
    descricao: formData.get("descricao"),
    valor: formData.get("valor"),
  });
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  await db.extratoBancarioLinha.create({
    data: {
      contaId,
      data: parsed.data.data,
      descricao: parsed.data.descricao,
      valor: new Prisma.Decimal(parsed.data.valor),
      origem: "manual",
    },
  });

  revalidatePath(`/contas-financeiras/${contaId}/conciliacao`);
  return {};
}

const conciliarSchema = z.object({
  movimentacaoId: z.string().min(1, "Selecione o movimento do sistema."),
  extratoLinhaId: z.string().min(1, "Selecione a linha do extrato."),
});

/** Casa uma MovimentacaoFinanceira do sistema com uma linha do extrato bancário real. */
export async function conciliarMovimentacao(
  contaId: string,
  _prev: ConciliacaoFormState,
  formData: FormData
): Promise<ConciliacaoFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;
  const empresaId = permissao.session.user.empresaId!;

  const parsed = conciliarSchema.safeParse({
    movimentacaoId: formData.get("movimentacaoId"),
    extratoLinhaId: formData.get("extratoLinhaId"),
  });
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const movimentacao = await db.movimentacaoFinanceira.findFirst({
    where: { id: parsed.data.movimentacaoId, contaId, empresaId },
  });
  if (!movimentacao) return { erro: "Movimento não encontrado." };
  if (movimentacao.statusConciliacao === "conciliado") return { erro: "Esse movimento já está conciliado." };

  const linha = await db.extratoBancarioLinha.findFirst({ where: { id: parsed.data.extratoLinhaId, contaId } });
  if (!linha) return { erro: "Linha do extrato não encontrada." };

  await db.movimentacaoFinanceira.update({
    where: { id: movimentacao.id },
    data: { statusConciliacao: "conciliado", conciliadoEm: new Date(), extratoBancarioId: linha.id },
  });

  revalidatePath(`/contas-financeiras/${contaId}/conciliacao`);
  return {};
}

/** Desfaz a conciliação — volta o movimento pra pendente, sem apagar a linha do extrato. */
export async function desconciliarMovimentacao(contaId: string, movimentacaoId: string) {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return;
  const empresaId = permissao.session.user.empresaId!;

  await db.movimentacaoFinanceira.updateMany({
    where: { id: movimentacaoId, contaId, empresaId },
    data: { statusConciliacao: "pendente", conciliadoEm: null, extratoBancarioId: null },
  });

  revalidatePath(`/contas-financeiras/${contaId}/conciliacao`);
}

const pendenciaSchema = z.object({
  extratoLinhaId: z.string().min(1),
  comentario: z.string().trim().transform(normalizarTexto).optional(),
});

/** Marca uma linha do extrato sem correspondência no sistema como Pendência — fica em aberto até virar Lançamento manualmente. */
export async function criarPendencia(
  contaId: string,
  _prev: ConciliacaoFormState,
  formData: FormData
): Promise<ConciliacaoFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;
  const empresaId = permissao.session.user.empresaId!;

  const parsed = pendenciaSchema.safeParse({
    extratoLinhaId: formData.get("extratoLinhaId"),
    comentario: formData.get("comentario"),
  });
  if (!parsed.success) return { erro: "Dados inválidos." };

  const conta = await db.contaFinanceira.findFirst({ where: { id: contaId, empresaId } });
  if (!conta) return { erro: "Conta financeira não encontrada." };

  const linha = await db.extratoBancarioLinha.findFirst({ where: { id: parsed.data.extratoLinhaId, contaId } });
  if (!linha) return { erro: "Linha do extrato não encontrada." };

  await db.pendenciaConciliacao.create({
    data: {
      contaId,
      tipo: Number(linha.valor) >= 0 ? "entrada" : "saida",
      data: linha.data,
      valor: linha.valor.abs(),
      comentario: parsed.data.comentario || null,
      origem: "manual",
    },
  });

  revalidatePath(`/contas-financeiras/${contaId}/conciliacao`);
  return {};
}

/** Marca uma Pendência como resolvida — o vínculo com o Lançamento que a originou, se algum, é feito manualmente hoje. */
export async function resolverPendencia(contaId: string, pendenciaId: string) {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return;
  const empresaId = permissao.session.user.empresaId!;

  await db.pendenciaConciliacao.updateMany({
    where: { id: pendenciaId, contaId, conta: { empresaId } },
    data: { resolvidoEm: new Date() },
  });

  revalidatePath(`/contas-financeiras/${contaId}/conciliacao`);
}
