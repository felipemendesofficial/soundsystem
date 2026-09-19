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

/**
 * Desfaz a conciliação — volta o movimento pra pendente, sem apagar a linha
 * do extrato. Se esse movimento tinha sido usado pra resolver uma Pendência
 * (via `vincularPendenciaAMovimento`), reabre a Pendência também — senão ela
 * ficaria "resolvida" mesmo com o movimento voltando a não bater com nada.
 */
export async function desconciliarMovimentacao(contaId: string, movimentacaoId: string) {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return;
  const empresaId = permissao.session.user.empresaId!;

  await db.$transaction([
    db.movimentacaoFinanceira.updateMany({
      where: { id: movimentacaoId, contaId, empresaId },
      data: { statusConciliacao: "pendente", conciliadoEm: null, extratoBancarioId: null },
    }),
    db.pendenciaConciliacao.updateMany({
      where: { movimentacaoVinculadaId: movimentacaoId, contaId },
      data: { resolvidoEm: null, movimentacaoVinculadaId: null, lancamentoId: null },
    }),
  ]);

  revalidatePath(`/contas-financeiras/${contaId}/conciliacao`);
  revalidatePath(`/contas-financeiras/${contaId}/extrato`);
}

const pendenciaSchema = z.object({
  data: z.coerce.date({ message: "Informe a data." }),
  valor: z.coerce.number().refine((v) => v !== 0, "Valor não pode ser zero."),
  comentario: z.string().trim().transform(normalizarTexto).optional(),
});

/** Lança uma Pendência direto — algo que a empresa já viu no extrato físico do banco, sem depender de cadastrar uma linha antes. Fica em aberto até ser vinculada a um movimento do sistema (ou resolvida sem vínculo). */
export async function criarPendencia(
  contaId: string,
  _prev: ConciliacaoFormState,
  formData: FormData
): Promise<ConciliacaoFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;
  const empresaId = permissao.session.user.empresaId!;

  const conta = await db.contaFinanceira.findFirst({ where: { id: contaId, empresaId } });
  if (!conta) return { erro: "Conta financeira não encontrada." };

  const parsed = pendenciaSchema.safeParse({
    data: formData.get("data"),
    valor: formData.get("valor"),
    comentario: formData.get("comentario"),
  });
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  await db.pendenciaConciliacao.create({
    data: {
      contaId,
      tipo: parsed.data.valor >= 0 ? "entrada" : "saida",
      data: parsed.data.data,
      valor: new Prisma.Decimal(Math.abs(parsed.data.valor)),
      comentario: parsed.data.comentario || null,
      origem: "manual",
    },
  });

  revalidatePath(`/contas-financeiras/${contaId}/conciliacao`);
  return {};
}

const resolverPendenciaSchema = z.object({
  pendenciaId: z.string().min(1, "Selecione a pendência."),
  dataResolucao: z.coerce.date({ message: "Informe a data em que foi resolvida." }),
});

/** Marca uma Pendência como resolvida sem vínculo com nenhum movimento — pra quando ela nunca vai virar um lançamento no sistema (ex.: erro do banco já corrigido por eles). A data é a data real em que foi resolvida, não necessariamente hoje. */
export async function resolverPendencia(
  contaId: string,
  _prev: ConciliacaoFormState,
  formData: FormData
): Promise<ConciliacaoFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;
  const empresaId = permissao.session.user.empresaId!;

  const parsed = resolverPendenciaSchema.safeParse({
    pendenciaId: formData.get("pendenciaId"),
    dataResolucao: formData.get("dataResolucao"),
  });
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const { count } = await db.pendenciaConciliacao.updateMany({
    where: { id: parsed.data.pendenciaId, contaId, conta: { empresaId }, resolvidoEm: null },
    data: { resolvidoEm: parsed.data.dataResolucao },
  });
  if (count === 0) return { erro: "Pendência não encontrada ou já resolvida." };

  revalidatePath(`/contas-financeiras/${contaId}/conciliacao`);
  return {};
}

/**
 * Estorna a resolução de uma Pendência que tinha sido resolvida SEM vínculo
 * (`resolverPendencia`) — volta pra aberta. Pendência resolvida COM vínculo
 * (`vincularPendenciaAMovimento`) já tem seu próprio caminho de estorno —
 * "Remover conciliação" no movimento do sistema, no Extrato — que reabre a
 * pendência automaticamente; por isso aqui só mexe em quem não tem vínculo,
 * pra não destravar as duas pontas (movimento + pendência) de formas diferentes.
 */
export async function estornarResolucaoPendencia(contaId: string, pendenciaId: string) {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return;
  const empresaId = permissao.session.user.empresaId!;

  await db.pendenciaConciliacao.updateMany({
    where: { id: pendenciaId, contaId, conta: { empresaId }, resolvidoEm: { not: null }, movimentacaoVinculadaId: null },
    data: { resolvidoEm: null },
  });

  revalidatePath(`/contas-financeiras/${contaId}/conciliacao`);
}

const vincularPendenciaSchema = z.object({
  pendenciaId: z.string().min(1, "Selecione a pendência."),
  movimentacaoId: z.string().min(1, "Selecione o movimento do sistema."),
});

/**
 * Fecha uma Pendência (algo que apareceu no extrato do banco antes de a
 * empresa reconhecer no sistema) contra um movimento do sistema que só
 * apareceu depois — o espelho de `conciliarMovimentacao` (que casa sistema
 * contra uma linha do extrato ainda sem pendência). Concilia o movimento
 * usando a data do banco (`pendencia.data`, não `new Date()` — é quando
 * aconteceu de fato) e resolve a pendência, preenchendo `lancamentoId`
 * quando o movimento tiver um (campo do schema pensado exatamente pra isso,
 * nunca usado até então).
 */
export async function vincularPendenciaAMovimento(
  contaId: string,
  _prev: ConciliacaoFormState,
  formData: FormData
): Promise<ConciliacaoFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;
  const empresaId = permissao.session.user.empresaId!;

  const parsed = vincularPendenciaSchema.safeParse({
    pendenciaId: formData.get("pendenciaId"),
    movimentacaoId: formData.get("movimentacaoId"),
  });
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const pendencia = await db.pendenciaConciliacao.findFirst({
    where: { id: parsed.data.pendenciaId, contaId, conta: { empresaId }, resolvidoEm: null },
  });
  if (!pendencia) return { erro: "Pendência não encontrada ou já resolvida." };

  const movimentacao = await db.movimentacaoFinanceira.findFirst({
    where: { id: parsed.data.movimentacaoId, contaId, empresaId, statusConciliacao: "pendente" },
  });
  if (!movimentacao) return { erro: "Movimento não encontrado ou já conciliado." };

  // Pendência guarda valor sempre positivo + tipo (entrada/saida); movimento
  // guarda o valor já com sinal — precisa comparar equivalente pra impedir
  // vincular coisas de valores diferentes por engano.
  const valorPendenciaAssinado = pendencia.tipo === "entrada" ? pendencia.valor : pendencia.valor.negated();
  if (!movimentacao.valor.equals(valorPendenciaAssinado)) {
    return {
      erro: `O valor do movimento (${Number(movimentacao.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}) não bate com o valor da pendência (${Number(valorPendenciaAssinado).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}).`,
    };
  }

  await db.$transaction([
    db.movimentacaoFinanceira.update({
      where: { id: movimentacao.id },
      data: { statusConciliacao: "conciliado", conciliadoEm: pendencia.data },
    }),
    db.pendenciaConciliacao.update({
      where: { id: pendencia.id },
      data: {
        resolvidoEm: new Date(),
        lancamentoId: movimentacao.lancamentoId ?? undefined,
        movimentacaoVinculadaId: movimentacao.id,
      },
    }),
  ]);

  revalidatePath(`/contas-financeiras/${contaId}/conciliacao`);
  revalidatePath(`/contas-financeiras/${contaId}/extrato`);
  return {};
}

export type ConciliarMovimentoState = { erro?: string };

/**
 * Concilia UM movimento específico com uma data própria — pro caso em que
 * cada lançamento compensou num dia diferente no extrato bancário real.
 * `movimentacaoId` vem do `name`/`value` do próprio botão que disparou este
 * `formAction` (cada linha tem o seu); a data vem de um campo com nome
 * dinâmico (`dataIndividual-<id>`) porque todas as linhas do extrato dividem
 * o mesmo `<form>` — ver `extrato-conta-lista.tsx`.
 */
export async function conciliarMovimentoComData(
  contaId: string,
  _prev: ConciliarMovimentoState,
  formData: FormData
): Promise<ConciliarMovimentoState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;
  const empresaId = permissao.session.user.empresaId!;

  const movimentacaoId = formData.get("movimentacaoId");
  if (typeof movimentacaoId !== "string" || !movimentacaoId) return { erro: "Selecione o movimento." };

  const parsedData = z.coerce
    .date({ message: "Informe a data de conciliação." })
    .safeParse(formData.get(`dataIndividual-${movimentacaoId}`));
  if (!parsedData.success) return { erro: parsedData.error.issues[0]?.message ?? "Informe a data." };

  const { count } = await db.movimentacaoFinanceira.updateMany({
    where: { id: movimentacaoId, contaId, empresaId, statusConciliacao: "pendente" },
    data: { statusConciliacao: "conciliado", conciliadoEm: parsedData.data },
  });
  if (count === 0) return { erro: "Movimento não encontrado ou já conciliado." };

  revalidatePath(`/contas-financeiras/${contaId}/extrato`);
  return {};
}

const conciliarLoteSchema = z.object({
  dataConciliacao: z.coerce.date({ message: "Informe a data de conciliação." }),
});

/**
 * Concilia em lote os movimentos marcados (checkboxes) na tela de Extrato,
 * todos com a mesma data escolhida — pensado pra "conciliar tudo que estiver
 * pendente no período que estou vendo agora", não uma varredura cega por data.
 */
export async function conciliarMovimentosSelecionados(
  contaId: string,
  _prev: ConciliarMovimentoState,
  formData: FormData
): Promise<ConciliarMovimentoState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;
  const empresaId = permissao.session.user.empresaId!;

  const ids = formData.getAll("movimentacaoIds").map(String).filter(Boolean);
  if (ids.length === 0) return { erro: "Selecione ao menos um movimento." };

  const parsedData = conciliarLoteSchema.safeParse({ dataConciliacao: formData.get("dataConciliacao") });
  if (!parsedData.success) return { erro: parsedData.error.issues[0]?.message ?? "Dados inválidos." };

  const { count } = await db.movimentacaoFinanceira.updateMany({
    where: { id: { in: ids }, contaId, empresaId, statusConciliacao: "pendente" },
    data: { statusConciliacao: "conciliado", conciliadoEm: parsedData.data.dataConciliacao },
  });

  revalidatePath(`/contas-financeiras/${contaId}/extrato`);
  return count === 0 ? { erro: "Nenhum dos selecionados estava pendente." } : {};
}
