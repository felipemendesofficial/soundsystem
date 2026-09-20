"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { normalizarTexto } from "@/lib/texto";
import { validarSomaPercentual } from "@/lib/rateio-financeiro";
import { Prisma } from "@/generated/prisma/client";
import { calcularProximaOcorrenciaRecorrente } from "@/lib/lancamento-recorrente";
import { criarLancamentoFinanceiroDeDados, type DadosLancamento } from "../lancamentos-financeiros/actions";

export type RecorrenteFormState = { erro?: string };
export type GerarPendenteFormState = { erro?: string };

async function exigirPermissao() {
  const session = await auth();
  if (!session?.user) return { erro: "Não autenticado." } as const;
  if (!podeGerenciarFinanceiro(session.user.perfil)) {
    return { erro: "Seu perfil não pode gerenciar o Financeiro." } as const;
  }
  return { session } as const;
}

function parseJsonArray<T extends z.ZodRawShape>(itemSchema: z.ZodObject<T>, opts: { min: number; label: string }) {
  return z.string().transform((valor, ctx) => {
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(valor);
    } catch {
      ctx.addIssue({ code: "custom", message: `${opts.label} inválido(s).` });
      return z.NEVER;
    }
    const resultado = z.array(itemSchema).min(opts.min, `Adicione ao menos ${opts.min} linha(s) de ${opts.label.toLowerCase()}.`).safeParse(parsedJson);
    if (!resultado.success) {
      ctx.addIssue({ code: "custom", message: resultado.error.issues[0]?.message ?? `${opts.label} inválido(s).` });
      return z.NEVER;
    }
    return resultado.data;
  });
}

const centroCustoLinhaSchema = z.object({ centroCustoId: z.string().min(1), percentual: z.coerce.number().positive() });
const rateioPlanoLinhaSchema = z.object({
  planoId: z.string().min(1),
  percentual: z.coerce.number().positive(),
  centroCusto: z.array(centroCustoLinhaSchema).default([]),
});
const rateioProcessoLinhaSchema = z.object({ processoItemId: z.string().min(1), percentual: z.coerce.number().positive() });

const recorrenteSchema = z.object({
  tipo: z.enum(["receita", "despesa"], { message: "Selecione o tipo." }),
  descricao: z.string().trim().min(1, "Informe a descrição.").transform(normalizarTexto),
  fornecedorId: z.string().trim().optional(),
  clienteId: z.string().trim().optional(),
  tipoDocumento: z.enum([
    "especie", "cheque_vista", "cheque_prazo", "cheque_devolvido", "deposito_cartorio",
    "nota_promissoria", "deposito_bancario", "pix", "cartao",
  ], { message: "Selecione o tipo de documento." }),
  contaPrevistaId: z.string().trim().optional(),
  processoId: z.string().min(1, "Selecione o processo."),
  natureza: z.enum(["real", "prevista"], { message: "Selecione a natureza." }),
  periodicidade: z.enum(["mensal", "bimestral", "trimestral", "semestral", "anual"], { message: "Selecione a periodicidade." }),
  diaVencimento: z.coerce.number().int().min(1).max(31),
  dataInicio: z.coerce.date({ message: "Informe a data de início." }),
  dataFim: z.coerce.date().optional(),
  rateioPlano: parseJsonArray(rateioPlanoLinhaSchema, { min: 1, label: "Rateio de Plano Financeiro" }),
  rateioProcesso: parseJsonArray(rateioProcessoLinhaSchema, { min: 1, label: "Rateio de Processo" }),
});

type DadosRecorrente = z.infer<typeof recorrenteSchema>;

function lerFormData(formData: FormData) {
  return recorrenteSchema.safeParse({
    tipo: formData.get("tipo"),
    descricao: formData.get("descricao"),
    fornecedorId: formData.get("fornecedorId"),
    clienteId: formData.get("clienteId"),
    tipoDocumento: formData.get("tipoDocumento"),
    contaPrevistaId: formData.get("contaPrevistaId"),
    processoId: formData.get("processoId"),
    natureza: formData.get("natureza"),
    periodicidade: formData.get("periodicidade"),
    diaVencimento: formData.get("diaVencimento"),
    dataInicio: formData.get("dataInicio"),
    dataFim: formData.get("dataFim") || undefined,
    rateioPlano: formData.get("rateioPlano"),
    rateioProcesso: formData.get("rateioProcesso"),
  });
}

async function validarRegrasDeNegocio(dados: DadosRecorrente, ctx: { empresaId: string; grupoId: string }) {
  const { empresaId, grupoId } = ctx;

  if (dados.tipo === "despesa") {
    if (!dados.fornecedorId) return { erro: "Selecione o fornecedor." } as const;
    if (dados.clienteId) return { erro: "Um recorrente de despesa não pode ter cliente." } as const;
  } else {
    if (!dados.clienteId) return { erro: "Selecione o cliente." } as const;
    if (dados.fornecedorId) return { erro: "Um recorrente de receita não pode ter fornecedor." } as const;
  }

  if (dados.dataFim && dados.dataFim < dados.dataInicio) {
    return { erro: "Data fim não pode ser anterior à data de início." } as const;
  }

  try {
    validarSomaPercentual(dados.rateioPlano.map((l) => ({ percentual: new Prisma.Decimal(l.percentual) })));
    for (const linha of dados.rateioPlano) {
      if (linha.centroCusto.length > 0) {
        validarSomaPercentual(linha.centroCusto.map((cc) => ({ percentual: new Prisma.Decimal(cc.percentual) })));
      }
    }
    validarSomaPercentual(dados.rateioProcesso.map((l) => ({ percentual: new Prisma.Decimal(l.percentual) })));
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Rateio inválido." } as const;
  }

  const processo = await db.processo.findFirst({ where: { id: dados.processoId, empresaId } });
  if (!processo) return { erro: "Processo não encontrado." } as const;

  const planoIds = dados.rateioPlano.map((l) => l.planoId);
  const planosValidos = await db.planoFinanceiro.count({
    where: { id: { in: planoIds }, grupoId, natureza: "analitica", ativo: true, tipo: dados.tipo },
  });
  if (planosValidos !== planoIds.length) return { erro: "Uma ou mais contas do rateio de Plano Financeiro são inválidas." } as const;

  const centroCustoIds = dados.rateioPlano.flatMap((l) => l.centroCusto.map((cc) => cc.centroCustoId));
  if (centroCustoIds.length > 0) {
    const centrosValidos = await db.centroCusto.count({ where: { id: { in: centroCustoIds }, grupoId, natureza: "analitica", ativo: true } });
    if (centrosValidos !== centroCustoIds.length) return { erro: "Uma ou mais contas do rateio de Centro de Custo são inválidas." } as const;
  }

  const processoItemIds = dados.rateioProcesso.map((l) => l.processoItemId);
  const itensValidos = await db.processoItem.count({ where: { id: { in: processoItemIds }, processoId: dados.processoId, natureza: "analitica", ativo: true } });
  if (itensValidos !== processoItemIds.length) return { erro: "Um ou mais itens do rateio de Processo são inválidos." } as const;

  if (dados.contaPrevistaId) {
    const conta = await db.contaFinanceira.findFirst({ where: { id: dados.contaPrevistaId, empresaId } });
    if (!conta) return { erro: "Conta prevista não encontrada." } as const;
  }

  return { ok: true } as const;
}

function montarDadosPersistencia(dados: DadosRecorrente) {
  return {
    tipo: dados.tipo,
    descricao: dados.descricao,
    fornecedorId: dados.fornecedorId || null,
    clienteId: dados.clienteId || null,
    tipoDocumento: dados.tipoDocumento,
    contaPrevistaId: dados.contaPrevistaId || null,
    processoId: dados.processoId,
    natureza: dados.natureza,
    periodicidade: dados.periodicidade,
    diaVencimento: dados.diaVencimento,
    dataInicio: dados.dataInicio,
    dataFim: dados.dataFim ?? null,
  };
}

export async function criarLancamentoFinanceiroRecorrente(
  _prev: RecorrenteFormState,
  formData: FormData
): Promise<RecorrenteFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;
  const empresaId = permissao.session.user.empresaId!;
  const grupoId = permissao.session.user.grupoId!;

  const parsed = lerFormData(formData);
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const dados = parsed.data;

  const validado = await validarRegrasDeNegocio(dados, { empresaId, grupoId });
  if ("erro" in validado) return validado;

  await db.lancamentoFinanceiroRecorrente.create({
    data: {
      empresaId,
      ...montarDadosPersistencia(dados),
      rateiosPlano: {
        create: dados.rateioPlano.map((l) => ({
          planoId: l.planoId,
          percentual: new Prisma.Decimal(l.percentual),
          rateiosCentroCusto: l.centroCusto.length > 0
            ? { create: l.centroCusto.map((cc) => ({ centroCustoId: cc.centroCustoId, percentual: new Prisma.Decimal(cc.percentual) })) }
            : undefined,
        })),
      },
      rateiosProcesso: {
        create: dados.rateioProcesso.map((l) => ({ processoItemId: l.processoItemId, percentual: new Prisma.Decimal(l.percentual) })),
      },
    },
  });

  revalidatePath("/lancamentos-financeiros-recorrentes");
  redirect("/lancamentos-financeiros-recorrentes");
}

export async function atualizarLancamentoFinanceiroRecorrente(
  recorrenteId: string,
  _prev: RecorrenteFormState,
  formData: FormData
): Promise<RecorrenteFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;
  const empresaId = permissao.session.user.empresaId!;
  const grupoId = permissao.session.user.grupoId!;

  const atual = await db.lancamentoFinanceiroRecorrente.findFirst({ where: { id: recorrenteId, empresaId } });
  if (!atual) return { erro: "Recorrente não encontrado." };

  const parsed = lerFormData(formData);
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const dados = parsed.data;

  if (dados.tipo !== atual.tipo) return { erro: "Não é possível trocar Despesa/Receita depois de criado." };

  const validado = await validarRegrasDeNegocio(dados, { empresaId, grupoId });
  if ("erro" in validado) return validado;

  await db.$transaction(async (tx) => {
    await tx.lancamentoFinanceiroRecorrenteRateioPlano.deleteMany({ where: { recorrenteId } });
    await tx.lancamentoFinanceiroRecorrenteRateioProcesso.deleteMany({ where: { recorrenteId } });
    await tx.lancamentoFinanceiroRecorrente.update({
      where: { id: recorrenteId },
      data: {
        ...montarDadosPersistencia(dados),
        rateiosPlano: {
          create: dados.rateioPlano.map((l) => ({
            planoId: l.planoId,
            percentual: new Prisma.Decimal(l.percentual),
            rateiosCentroCusto: l.centroCusto.length > 0
              ? { create: l.centroCusto.map((cc) => ({ centroCustoId: cc.centroCustoId, percentual: new Prisma.Decimal(cc.percentual) })) }
              : undefined,
          })),
        },
        rateiosProcesso: {
          create: dados.rateioProcesso.map((l) => ({ processoItemId: l.processoItemId, percentual: new Prisma.Decimal(l.percentual) })),
        },
      },
    });
  });

  revalidatePath("/lancamentos-financeiros-recorrentes");
  redirect("/lancamentos-financeiros-recorrentes");
}

export async function alternarAtivoRecorrente(id: string, ativo: boolean) {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return;
  await db.lancamentoFinanceiroRecorrente.updateMany({ where: { id, empresaId: permissao.session.user.empresaId! }, data: { ativo } });
  revalidatePath("/lancamentos-financeiros-recorrentes");
}

/** Monta o `DadosLancamento` (mesmo formato do form de Lançamento) a partir do template + valor informado na geração. */
async function montarDadosLancamentoDoRecorrente(
  recorrenteId: string,
  empresaId: string,
  valor: number
): Promise<{ dados: DadosLancamento; proximaOcorrencia: Date } | { erro: string }> {
  const recorrente = await db.lancamentoFinanceiroRecorrente.findFirst({
    where: { id: recorrenteId, empresaId, ativo: true },
    include: { rateiosPlano: { include: { rateiosCentroCusto: true } }, rateiosProcesso: true },
  });
  if (!recorrente) return { erro: "Recorrente não encontrado ou inativo." };

  const ultimoGerado = await db.lancamentoFinanceiro.findFirst({
    where: { recorrenteId },
    orderBy: { dataVencimento: "desc" },
  });

  const proximaOcorrencia = calcularProximaOcorrenciaRecorrente(recorrente, ultimoGerado?.dataVencimento ?? null);
  if (!proximaOcorrencia) return { erro: "Este recorrente já passou da data fim — não há mais ocorrências a gerar." };

  const dados: DadosLancamento = {
    tipo: recorrente.tipo,
    natureza: recorrente.natureza,
    historicoSimplificado: recorrente.descricao,
    historicoComplementar: undefined,
    documento: undefined,
    documentoFisico: undefined,
    tipoDocumento: recorrente.tipoDocumento,
    portadorId: undefined,
    contaPrevistaId: recorrente.contaPrevistaId ?? undefined,
    clienteId: recorrente.clienteId ?? undefined,
    fornecedorId: recorrente.fornecedorId ?? undefined,
    valorOriginal: valor,
    dataEmissao: proximaOcorrencia,
    dataVencimento: proximaOcorrencia,
    // Sem input de usuário aqui (geração automática) — mesma suposição seguida
    // no backfill de dataPrevisao: igual ao vencimento, ajustável depois.
    dataPrevisao: proximaOcorrencia,
    moraMes: undefined,
    processoId: recorrente.processoId,
    observacao: `Gerado automaticamente do recorrente "${recorrente.descricao}".`,
    rateioPlano: recorrente.rateiosPlano.map((rp) => ({
      planoId: rp.planoId,
      percentual: Number(rp.percentual),
      centroCusto: rp.rateiosCentroCusto.map((cc) => ({ centroCustoId: cc.centroCustoId, percentual: Number(cc.percentual) })),
    })),
    rateioProcesso: recorrente.rateiosProcesso.map((rp) => ({ processoItemId: rp.processoItemId, percentual: Number(rp.percentual) })),
    retencoes: [],
    comissoes: [],
    chequeBanco: undefined,
    chequeAgencia: undefined,
    chequeNumeroCheque: undefined,
    chequeContaCorrente: undefined,
    chequeCgc: undefined,
    chequeCpf: undefined,
    chequeTelefone: undefined,
    chequeTerceiro: undefined,
    cartaoOperadoraId: undefined,
    cartaoOperadoraCartaoTaxaId: undefined,
    cartaoNumeroCartao: undefined,
    cartaoNumeroAutorizacao: undefined,
    cartaoTipoTaxa: undefined,
  };

  return { dados, proximaOcorrencia };
}

/** Gera UMA ocorrência pendente de um recorrente — valor sempre digitado/confirmado pelo usuário nesta tela, nunca automático. */
export async function gerarPendente(
  recorrenteId: string,
  _prev: GerarPendenteFormState,
  formData: FormData
): Promise<GerarPendenteFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;
  const empresaId = permissao.session.user.empresaId!;
  const grupoId = permissao.session.user.grupoId!;

  const valorParsed = z.coerce.number().positive("Informe um valor maior que zero.").safeParse(formData.get("valor"));
  if (!valorParsed.success) return { erro: valorParsed.error.issues[0]?.message ?? "Valor inválido." };

  const montado = await montarDadosLancamentoDoRecorrente(recorrenteId, empresaId, valorParsed.data);
  if ("erro" in montado) return montado;

  const resultado = await criarLancamentoFinanceiroDeDados(montado.dados, {
    empresaId,
    grupoId,
    criadoPorId: permissao.session.user.id,
    recorrenteId,
  });
  if ("erro" in resultado) return resultado;

  revalidatePath("/lancamentos-financeiros-recorrentes/gerar");
  revalidatePath("/lancamentos-financeiros");
  return {};
}

/**
 * Gera em lote todos os recorrentes pendentes que já têm um valor sugerido
 * (uma geração anterior de onde puxar o `valorOriginal`) — os que nunca
 * foram gerados antes não têm valor conhecido e precisam de confirmação
 * individual via `gerarPendente`.
 */
export async function gerarTodosPendentesComValorConhecido(): Promise<{ erro?: string; gerados?: number }> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;
  const empresaId = permissao.session.user.empresaId!;
  const grupoId = permissao.session.user.grupoId!;

  const recorrentes = await db.lancamentoFinanceiroRecorrente.findMany({
    where: { empresaId, ativo: true },
    include: { rateiosPlano: { include: { rateiosCentroCusto: true } }, rateiosProcesso: true },
  });

  let gerados = 0;
  for (const recorrente of recorrentes) {
    const ultimoGerado = await db.lancamentoFinanceiro.findFirst({
      where: { recorrenteId: recorrente.id },
      orderBy: { dataVencimento: "desc" },
    });
    if (!ultimoGerado) continue; // sem valor sugerido — precisa de confirmação individual

    const proximaOcorrencia = calcularProximaOcorrenciaRecorrente(recorrente, ultimoGerado.dataVencimento);
    if (!proximaOcorrencia || proximaOcorrencia.getTime() > new Date().getTime()) continue; // não é pendente ainda

    const montado = await montarDadosLancamentoDoRecorrente(recorrente.id, empresaId, Number(ultimoGerado.valorOriginal));
    if ("erro" in montado) continue;

    const resultado = await criarLancamentoFinanceiroDeDados(montado.dados, {
      empresaId,
      grupoId,
      criadoPorId: permissao.session.user.id,
      recorrenteId: recorrente.id,
    });
    if (!("erro" in resultado)) gerados++;
  }

  revalidatePath("/lancamentos-financeiros-recorrentes/gerar");
  revalidatePath("/lancamentos-financeiros");
  return { gerados };
}
