"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { normalizarTexto } from "@/lib/texto";
import { validarSomaPercentual, distribuirValor } from "@/lib/rateio-financeiro";
import { registrarBaixa, registrarEstorno, obterUltimoFechamentoAtivo } from "@/lib/financeiro-ledger";

export type LancamentoFinanceiroFormState = { erro?: string };
export type BaixaFormState = { erro?: string };
export type EstornoFormState = { erro?: string };

async function exigirPermissao() {
  const session = await auth();
  if (!session?.user) return { erro: "Não autenticado." } as const;
  if (!podeGerenciarFinanceiro(session.user.perfil)) {
    return { erro: "Seu perfil não pode gerenciar o Financeiro." } as const;
  }
  return { session } as const;
}

function parseJsonArray<T extends z.ZodRawShape>(
  itemSchema: z.ZodObject<T>,
  opts: { min: number; label: string }
) {
  return z.string().transform((valor, ctx) => {
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(valor);
    } catch {
      ctx.addIssue({ code: "custom", message: `${opts.label} inválido(s).` });
      return z.NEVER;
    }
    const resultado = z
      .array(itemSchema)
      .min(opts.min, `Adicione ao menos ${opts.min} linha(s) de ${opts.label.toLowerCase()}.`)
      .safeParse(parsedJson);
    if (!resultado.success) {
      ctx.addIssue({ code: "custom", message: resultado.error.issues[0]?.message ?? `${opts.label} inválido(s).` });
      return z.NEVER;
    }
    return resultado.data;
  });
}

const centroCustoLinhaSchema = z.object({
  centroCustoId: z.string().min(1),
  percentual: z.coerce.number().positive(),
});

const rateioPlanoLinhaSchema = z.object({
  planoId: z.string().min(1),
  percentual: z.coerce.number().positive(),
  centroCusto: z.array(centroCustoLinhaSchema).default([]),
});

const rateioProcessoLinhaSchema = z.object({
  processoItemId: z.string().min(1),
  percentual: z.coerce.number().positive(),
});

const retencaoLinhaSchema = z.object({
  planoId: z.string().min(1),
  percentual: z.coerce.number().positive(),
});

const comissaoLinhaSchema = z.object({
  vendedorId: z.string().min(1),
  percentual: z.coerce.number().positive(),
});

const TIPOS_DOCUMENTO = [
  "especie",
  "cheque_vista",
  "cheque_prazo",
  "cheque_devolvido",
  "deposito_cartorio",
  "nota_promissoria",
  "deposito_bancario",
  "pix",
  "cartao",
] as const;

const criarSchema = z.object({
  tipo: z.enum(["receita", "despesa"], { message: "Selecione o tipo." }),
  historicoSimplificado: z.string().trim().min(1, "Informe o histórico.").transform(normalizarTexto),
  historicoComplementar: z.string().trim().transform(normalizarTexto).optional(),
  documento: z.string().trim().optional(),
  documentoFisico: z.enum(["on"]).nullish(),
  tipoDocumento: z.enum(TIPOS_DOCUMENTO, { message: "Selecione o tipo de documento." }),
  portadorId: z.string().trim().optional(),
  contaPrevistaId: z.string().trim().optional(),
  clienteId: z.string().trim().optional(),
  fornecedorId: z.string().trim().optional(),
  valorOriginal: z.coerce.number().positive("Valor deve ser maior que zero."),
  dataEmissao: z.coerce.date({ message: "Informe a data de emissão." }),
  dataVencimento: z.coerce.date({ message: "Informe a data de vencimento." }),
  moraMes: z.coerce.number().nonnegative("Mora não pode ser negativa.").optional(),
  processoId: z.string().min(1, "Selecione o processo."),
  observacao: z.string().trim().transform(normalizarTexto).optional(),
  rateioPlano: parseJsonArray(rateioPlanoLinhaSchema, { min: 1, label: "Rateio de Plano Financeiro" }),
  rateioProcesso: parseJsonArray(rateioProcessoLinhaSchema, { min: 1, label: "Rateio de Processo" }),
  retencoes: parseJsonArray(retencaoLinhaSchema, { min: 0, label: "Retenções" }),
  comissoes: parseJsonArray(comissaoLinhaSchema, { min: 0, label: "Comissões" }),
  chequeBanco: z.string().trim().optional(),
  chequeAgencia: z.string().trim().optional(),
  chequeNumeroCheque: z.string().trim().optional(),
  chequeContaCorrente: z.string().trim().optional(),
  chequeCgc: z.string().trim().optional(),
  chequeCpf: z.string().trim().optional(),
  chequeTelefone: z.string().trim().optional(),
  chequeTerceiroClienteId: z.string().trim().optional(),
  chequeTerceiroFornecedorId: z.string().trim().optional(),
  cartaoOperadora: z.string().trim().optional(),
  cartaoNumeroCartao: z.string().trim().optional(),
  cartaoLoteRv: z.string().trim().optional(),
  cartaoNumeroAutorizacao: z.string().trim().optional(),
  cartaoTipoTaxa: z.enum(["a_vista", "antecipacao", "parc_estabelecimento", "parc_cliente"]).optional(),
});

/**
 * Cadastra um Lançamento Financeiro (conta a pagar/receber) com o rateio
 * triplo. Nunca move dinheiro nem grava no ledger — isso só acontece na
 * Baixa (`darBaixaLancamento`), mesmo espírito do estoque (um Lançamento de
 * compra só afeta o Kardex quando confirmado). `natureza` fica sempre `real`
 * nesta leva — `prevista` (previsão orçamentária) exige um fluxo de
 * conversão que ainda não existe.
 */
export async function criarLancamentoFinanceiro(
  _prev: LancamentoFinanceiroFormState,
  formData: FormData
): Promise<LancamentoFinanceiroFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;
  const empresaId = permissao.session.user.empresaId!;
  const grupoId = permissao.session.user.grupoId!;

  const parsed = criarSchema.safeParse({
    tipo: formData.get("tipo"),
    historicoSimplificado: formData.get("historicoSimplificado"),
    historicoComplementar: formData.get("historicoComplementar"),
    documento: formData.get("documento"),
    documentoFisico: formData.get("documentoFisico"),
    tipoDocumento: formData.get("tipoDocumento"),
    portadorId: formData.get("portadorId"),
    contaPrevistaId: formData.get("contaPrevistaId"),
    clienteId: formData.get("clienteId"),
    fornecedorId: formData.get("fornecedorId"),
    valorOriginal: formData.get("valorOriginal"),
    dataEmissao: formData.get("dataEmissao"),
    dataVencimento: formData.get("dataVencimento"),
    moraMes: formData.get("moraMes") || undefined,
    processoId: formData.get("processoId"),
    observacao: formData.get("observacao"),
    rateioPlano: formData.get("rateioPlano"),
    rateioProcesso: formData.get("rateioProcesso"),
    retencoes: formData.get("retencoes"),
    comissoes: formData.get("comissoes"),
    chequeBanco: formData.get("chequeBanco"),
    chequeAgencia: formData.get("chequeAgencia"),
    chequeNumeroCheque: formData.get("chequeNumeroCheque"),
    chequeContaCorrente: formData.get("chequeContaCorrente"),
    chequeCgc: formData.get("chequeCgc"),
    chequeCpf: formData.get("chequeCpf"),
    chequeTelefone: formData.get("chequeTelefone"),
    chequeTerceiroClienteId: formData.get("chequeTerceiroClienteId"),
    chequeTerceiroFornecedorId: formData.get("chequeTerceiroFornecedorId"),
    cartaoOperadora: formData.get("cartaoOperadora"),
    cartaoNumeroCartao: formData.get("cartaoNumeroCartao"),
    cartaoLoteRv: formData.get("cartaoLoteRv"),
    cartaoNumeroAutorizacao: formData.get("cartaoNumeroAutorizacao"),
    cartaoTipoTaxa: formData.get("cartaoTipoTaxa") || undefined,
  });
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const dados = parsed.data;

  if (dados.tipo === "despesa") {
    if (!dados.fornecedorId) return { erro: "Selecione o fornecedor." };
    if (dados.clienteId) return { erro: "Uma despesa não pode ter cliente." };
  } else {
    if (!dados.clienteId) return { erro: "Selecione o cliente." };
    if (dados.fornecedorId) return { erro: "Uma receita não pode ter fornecedor." };
  }
  if (dados.chequeTerceiroClienteId && dados.chequeTerceiroFornecedorId) {
    return { erro: "O cheque de terceiro só pode ter um dono: cliente ou fornecedor." };
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
    return { erro: e instanceof Error ? e.message : "Rateio inválido." };
  }

  const processo = await db.processo.findFirst({ where: { id: dados.processoId, empresaId } });
  if (!processo) return { erro: "Processo não encontrado." };

  const planoIds = dados.rateioPlano.map((l) => l.planoId);
  const planosValidos = await db.planoFinanceiro.count({
    where: { id: { in: planoIds }, grupoId, natureza: "analitica", ativo: true, tipo: dados.tipo },
  });
  if (planosValidos !== planoIds.length) return { erro: "Uma ou mais contas do rateio de Plano Financeiro são inválidas." };

  const centroCustoIds = dados.rateioPlano.flatMap((l) => l.centroCusto.map((cc) => cc.centroCustoId));
  if (centroCustoIds.length > 0) {
    const centrosValidos = await db.centroCusto.count({
      where: { id: { in: centroCustoIds }, grupoId, natureza: "analitica", ativo: true },
    });
    if (centrosValidos !== centroCustoIds.length) return { erro: "Uma ou mais contas do rateio de Centro de Custo são inválidas." };
  }

  const processoItemIds = dados.rateioProcesso.map((l) => l.processoItemId);
  const itensValidos = await db.processoItem.count({
    where: { id: { in: processoItemIds }, processoId: dados.processoId, natureza: "analitica", ativo: true },
  });
  if (itensValidos !== processoItemIds.length) return { erro: "Um ou mais itens do rateio de Processo são inválidos." };

  if (dados.retencoes.length > 0) {
    const retencaoPlanoIds = dados.retencoes.map((r) => r.planoId);
    const retencaoPlanosValidos = await db.planoFinanceiro.count({
      where: { id: { in: retencaoPlanoIds }, grupoId, natureza: "analitica", ativo: true },
    });
    if (retencaoPlanosValidos !== retencaoPlanoIds.length) return { erro: "Uma ou mais contas de retenção são inválidas." };
  }
  if (dados.comissoes.length > 0) {
    const vendedorIds = dados.comissoes.map((c) => c.vendedorId);
    const vendedoresValidos = await db.vendedor.count({ where: { id: { in: vendedorIds }, grupoId, ativo: true } });
    if (vendedoresValidos !== vendedorIds.length) return { erro: "Um ou mais vendedores de comissão são inválidos." };
  }

  const ultimoFechamento = await obterUltimoFechamentoAtivo(db, empresaId);
  const dataMovimento = ultimoFechamento?.data ?? new Date();

  const valorOriginal = new Prisma.Decimal(dados.valorOriginal);
  const rateioPlanoDistribuido = distribuirValor(
    valorOriginal,
    dados.rateioPlano.map((l) => ({ ...l, percentual: new Prisma.Decimal(l.percentual) }))
  );
  const rateioProcessoDistribuido = distribuirValor(
    valorOriginal,
    dados.rateioProcesso.map((l) => ({ ...l, percentual: new Prisma.Decimal(l.percentual) }))
  );

  let lancamentoId: string;
  try {
    const lancamento = await db.lancamentoFinanceiro.create({
      data: {
        empresaId,
        tipo: dados.tipo,
        natureza: "real",
        historicoSimplificado: dados.historicoSimplificado,
        historicoComplementar: dados.historicoComplementar || null,
        documento: dados.documento || null,
        documentoFisico: dados.documentoFisico === "on",
        tipoDocumento: dados.tipoDocumento,
        portadorId: dados.portadorId || null,
        contaPrevistaId: dados.contaPrevistaId || null,
        clienteId: dados.clienteId || null,
        fornecedorId: dados.fornecedorId || null,
        valorOriginal,
        dataEmissao: dados.dataEmissao,
        dataVencimento: dados.dataVencimento,
        dataMovimento,
        moraMes: dados.moraMes !== undefined ? new Prisma.Decimal(dados.moraMes) : null,
        processoId: dados.processoId,
        observacao: dados.observacao || null,
        rateios: {
          create: rateioPlanoDistribuido.map((l) => ({
            planoId: l.planoId,
            percentual: new Prisma.Decimal(l.percentual),
            valor: l.valor,
            rateiosCentroCusto:
              l.centroCusto.length > 0
                ? {
                    create: distribuirValor(
                      l.valor,
                      l.centroCusto.map((cc) => ({ ...cc, percentual: new Prisma.Decimal(cc.percentual) }))
                    ).map((cc) => ({
                      centroCustoId: cc.centroCustoId,
                      percentual: new Prisma.Decimal(cc.percentual),
                      valor: cc.valor,
                    })),
                  }
                : undefined,
          })),
        },
        rateiosProcesso: {
          create: rateioProcessoDistribuido.map((l) => ({
            processoItemId: l.processoItemId,
            percentual: new Prisma.Decimal(l.percentual),
            valor: l.valor,
          })),
        },
        retencoes:
          dados.retencoes.length > 0
            ? {
                create: dados.retencoes.map((r) => ({
                  planoId: r.planoId,
                  percentual: new Prisma.Decimal(r.percentual),
                  valor: valorOriginal.times(r.percentual).dividedBy(100).toDecimalPlaces(2),
                })),
              }
            : undefined,
        comissoes:
          dados.comissoes.length > 0
            ? {
                create: dados.comissoes.map((c) => ({
                  vendedorId: c.vendedorId,
                  percentual: new Prisma.Decimal(c.percentual),
                  valor: valorOriginal.times(c.percentual).dividedBy(100).toDecimalPlaces(2),
                })),
              }
            : undefined,
        dadosCheque: dados.tipoDocumento.startsWith("cheque_")
          ? {
              create: {
                banco: dados.chequeBanco || null,
                agencia: dados.chequeAgencia || null,
                numeroCheque: dados.chequeNumeroCheque || null,
                contaCorrente: dados.chequeContaCorrente || null,
                cgc: dados.chequeCgc || null,
                cpf: dados.chequeCpf || null,
                telefone: dados.chequeTelefone || null,
                terceiroClienteId: dados.chequeTerceiroClienteId || null,
                terceiroFornecedorId: dados.chequeTerceiroFornecedorId || null,
              },
            }
          : undefined,
        dadosCartao:
          dados.tipoDocumento === "cartao"
            ? {
                create: {
                  operadora: dados.cartaoOperadora || null,
                  numeroCartao: dados.cartaoNumeroCartao || null,
                  loteRv: dados.cartaoLoteRv || null,
                  numeroAutorizacao: dados.cartaoNumeroAutorizacao || null,
                  tipoTaxa: dados.cartaoTipoTaxa || null,
                },
              }
            : undefined,
      },
    });
    lancamentoId = lancamento.id;
  } catch {
    return { erro: "Não foi possível salvar o lançamento." };
  }

  revalidatePath("/lancamentos-financeiros");
  redirect(`/lancamentos-financeiros/${lancamentoId}`);
}

const baixaSchema = z.object({
  contaId: z.string().min(1, "Selecione a conta."),
  dataBaixa: z.coerce.date({ message: "Informe a data da baixa." }),
  juros: z.coerce.number().nonnegative("Juros não pode ser negativo.").optional(),
  multa: z.coerce.number().nonnegative("Multa não pode ser negativa.").optional(),
  desconto: z.coerce.number().nonnegative("Desconto não pode ser negativo.").optional(),
  historicoComplementar: z.string().trim().transform(normalizarTexto).optional(),
});

/** Dá baixa num Lançamento Financeiro `aberto` — grava o ledger e atualiza o saldo via `src/lib/financeiro-ledger.ts`. */
export async function darBaixaLancamento(
  lancamentoId: string,
  _prev: BaixaFormState,
  formData: FormData
): Promise<BaixaFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;
  const empresaId = permissao.session.user.empresaId!;

  const lancamento = await db.lancamentoFinanceiro.findFirst({ where: { id: lancamentoId, empresaId } });
  if (!lancamento) return { erro: "Lançamento não encontrado." };

  const parsed = baixaSchema.safeParse({
    contaId: formData.get("contaId"),
    dataBaixa: formData.get("dataBaixa"),
    juros: formData.get("juros") || undefined,
    multa: formData.get("multa") || undefined,
    desconto: formData.get("desconto") || undefined,
    historicoComplementar: formData.get("historicoComplementar"),
  });
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const conta = await db.contaFinanceira.findFirst({ where: { id: parsed.data.contaId, empresaId } });
  if (!conta) return { erro: "Conta financeira não encontrada." };

  try {
    await registrarBaixa({
      lancamentoId,
      contaId: parsed.data.contaId,
      dataBaixa: parsed.data.dataBaixa,
      juros: new Prisma.Decimal(parsed.data.juros ?? 0),
      multa: new Prisma.Decimal(parsed.data.multa ?? 0),
      desconto: new Prisma.Decimal(parsed.data.desconto ?? 0),
      historicoComplementar: parsed.data.historicoComplementar,
    });
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Não foi possível dar baixa." };
  }

  revalidatePath("/lancamentos-financeiros");
  revalidatePath(`/lancamentos-financeiros/${lancamentoId}`);
  redirect(`/lancamentos-financeiros/${lancamentoId}`);
}

const estornoSchema = z.object({
  contaId: z.string().min(1, "Selecione a conta."),
  motivo: z.string().trim().min(1, "Informe o motivo.").transform(normalizarTexto),
  dataEstorno: z.coerce.date({ message: "Informe a data do estorno." }),
  alineaDevolucaoId: z.string().trim().optional(),
});

/** Estorna a Baixa ativa de um Lançamento Financeiro via `src/lib/financeiro-ledger.ts`. */
export async function estornarBaixaLancamento(
  lancamentoId: string,
  _prev: EstornoFormState,
  formData: FormData
): Promise<EstornoFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;
  const empresaId = permissao.session.user.empresaId!;

  const lancamento = await db.lancamentoFinanceiro.findFirst({ where: { id: lancamentoId, empresaId } });
  if (!lancamento) return { erro: "Lançamento não encontrado." };

  const baixaAtiva = await db.baixa.findFirst({ where: { lancamentoId, estornada: false } });
  if (!baixaAtiva) return { erro: "Não há baixa ativa para estornar." };

  const parsed = estornoSchema.safeParse({
    contaId: formData.get("contaId"),
    motivo: formData.get("motivo"),
    dataEstorno: formData.get("dataEstorno"),
    alineaDevolucaoId: formData.get("alineaDevolucaoId"),
  });
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const conta = await db.contaFinanceira.findFirst({ where: { id: parsed.data.contaId, empresaId } });
  if (!conta) return { erro: "Conta financeira não encontrada." };

  try {
    await registrarEstorno({
      baixaId: baixaAtiva.id,
      contaId: parsed.data.contaId,
      motivo: parsed.data.motivo,
      dataEstorno: parsed.data.dataEstorno,
      alineaDevolucaoId: parsed.data.alineaDevolucaoId,
    });
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Não foi possível estornar a baixa." };
  }

  revalidatePath("/lancamentos-financeiros");
  revalidatePath(`/lancamentos-financeiros/${lancamentoId}`);
  redirect(`/lancamentos-financeiros/${lancamentoId}`);
}
