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
import {
  registrarBaixaNaTransacao,
  registrarEstornoNaTransacao,
  obterUltimoFechamentoAtivo,
} from "@/lib/financeiro-ledger";
import { erroContaParaBaixa } from "@/lib/regras-conta-baixa";
import { adicionarMesesUTC } from "@/lib/lancamento-recorrente";

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

const lancamentoSchema = z.object({
  tipo: z.enum(["receita", "despesa"], { message: "Selecione o tipo." }),
  natureza: z.enum(["real", "prevista"], { message: "Selecione a natureza." }),
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
  dataPrevisao: z.coerce.date({ message: "Informe a data de previsão." }),
  moraMes: z.coerce.number().nonnegative("Mora não pode ser negativa.").optional(),
  parcelado: z.enum(["on"]).nullish(),
  numeroParcelas: z.coerce.number().int().min(2, "Mínimo de 2 parcelas.").optional(),
  processoId: z.string().min(1, "Selecione o processo."),
  observacao: z.string().trim().transform(normalizarTexto).optional(),
  rateioPlano: parseJsonArray(rateioPlanoLinhaSchema, { min: 1, label: "Rateio de Plano Financeiro" }),
  rateioProcesso: parseJsonArray(rateioProcessoLinhaSchema, { min: 1, label: "Rateio de Processo" }),
  retencoes: parseJsonArray(retencaoLinhaSchema, { min: 0, label: "Retenções" }),
  comissoes: parseJsonArray(comissaoLinhaSchema, { min: 0, label: "Comissões" }),
  chequeBanco: z.string().trim().nullish(),
  chequeAgencia: z.string().trim().nullish(),
  chequeNumeroCheque: z.string().trim().nullish(),
  chequeContaCorrente: z.string().trim().nullish(),
  chequeCgc: z.string().trim().nullish(),
  chequeCpf: z.string().trim().nullish(),
  chequeTelefone: z.string().trim().nullish(),
  chequeTerceiro: z.string().trim().nullish(),
  cartaoOperadoraId: z.string().trim().nullish(),
  cartaoOperadoraCartaoTaxaId: z.string().trim().nullish(),
  cartaoBandeiraId: z.string().trim().nullish(),
  cartaoNumeroCartao: z.string().trim().nullish(),
  cartaoNumeroAutorizacao: z.string().trim().nullish(),
  cartaoTipoTaxa: z.enum(["a_vista", "antecipacao", "parc_estabelecimento", "parc_cliente"]).optional(),
}).refine((dados) => dados.dataVencimento >= dados.dataEmissao, {
  message: "Vencimento não pode ser anterior à emissão.",
  path: ["dataVencimento"],
}).refine((dados) => dados.parcelado !== "on" || (dados.numeroParcelas ?? 0) >= 2, {
  message: "Informe o número de parcelas (mínimo 2).",
  path: ["numeroParcelas"],
}).refine((dados) => !(dados.tipoDocumento === "cartao" && dados.tipo === "receita") || !!dados.cartaoOperadoraId, {
  message: "Operadora é obrigatória para Receita paga com cartão.",
  path: ["cartaoOperadoraId"],
}).refine((dados) => !(dados.tipoDocumento === "cartao" && dados.tipo === "receita") || !!dados.cartaoOperadoraCartaoTaxaId, {
  message: "Selecione a combinação de bandeira/modalidade pra calcular a taxa aplicada.",
  path: ["cartaoOperadoraCartaoTaxaId"],
}).refine((dados) => !(dados.tipoDocumento === "cartao" && dados.tipo === "despesa") || !!dados.cartaoBandeiraId, {
  message: "Selecione a bandeira do cartão.",
  path: ["cartaoBandeiraId"],
});

export type DadosLancamento = z.infer<typeof lancamentoSchema>;

function lerFormData(formData: FormData) {
  return lancamentoSchema.safeParse({
    tipo: formData.get("tipo"),
    natureza: formData.get("natureza"),
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
    dataPrevisao: formData.get("dataPrevisao"),
    moraMes: formData.get("moraMes") || undefined,
    parcelado: formData.get("parcelado"),
    numeroParcelas: formData.get("numeroParcelas") || undefined,
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
    chequeTerceiro: formData.get("chequeTerceiro"),
    cartaoOperadoraId: formData.get("cartaoOperadoraId"),
    cartaoOperadoraCartaoTaxaId: formData.get("cartaoOperadoraCartaoTaxaId"),
    cartaoBandeiraId: formData.get("cartaoBandeiraId"),
    cartaoNumeroCartao: formData.get("cartaoNumeroCartao"),
    cartaoNumeroAutorizacao: formData.get("cartaoNumeroAutorizacao"),
    cartaoTipoTaxa: formData.get("cartaoTipoTaxa") || undefined,
  });
}

/** Aplica os percentuais de rateio (Plano×Centro de Custo e Processo) sobre um valor — extraído pra ser reusado por parcela no Parcelamento, que precisa do rateio recalculado sobre o valor de CADA parcela, nunca sobre o valor total do título. */
function distribuirRateios(dados: DadosLancamento, valor: Prisma.Decimal) {
  const rateioPlanoDistribuido = distribuirValor(
    valor,
    dados.rateioPlano.map((l) => ({ ...l, percentual: new Prisma.Decimal(l.percentual) }))
  );
  const rateioProcessoDistribuido = distribuirValor(
    valor,
    dados.rateioProcesso.map((l) => ({ ...l, percentual: new Prisma.Decimal(l.percentual) }))
  );
  return { rateioPlanoDistribuido, rateioProcessoDistribuido };
}

/**
 * Valida as regras de negócio (contraparte × tipo, somas de rateio, existência
 * e ativação das contas referenciadas) e devolve os valores já distribuídos —
 * compartilhado entre criar/atualizar pra não duplicar essa validação.
 */
async function validarRegrasDeNegocio(dados: DadosLancamento, ctx: { empresaId: string; grupoId: string }) {
  const { empresaId, grupoId } = ctx;

  if (dados.tipo === "despesa") {
    if (!dados.fornecedorId) return { erro: "Selecione o fornecedor." } as const;
    if (dados.clienteId) return { erro: "Uma despesa não pode ter cliente." } as const;
  } else {
    if (!dados.clienteId) return { erro: "Selecione o cliente." } as const;
    if (dados.fornecedorId) return { erro: "Uma receita não pode ter fornecedor." } as const;
  }

  if (dados.contaPrevistaId) {
    const contaPrevista = await db.contaFinanceira.findFirst({ where: { id: dados.contaPrevistaId, empresaId } });
    if (!contaPrevista) return { erro: "Conta prevista não encontrada." } as const;
    const erroContaPrevista = erroContaParaBaixa(contaPrevista, { tipoLancamento: dados.tipo, tipoDocumento: dados.tipoDocumento });
    if (erroContaPrevista) return { erro: erroContaPrevista } as const;
  }

  let percentualAplicado: Prisma.Decimal | null = null;
  if (dados.tipoDocumento === "cartao" && dados.cartaoOperadoraId) {
    const operadora = await db.operadoraCartao.findFirst({ where: { id: dados.cartaoOperadoraId, empresaId } });
    if (!operadora) return { erro: "Operadora de cartão não encontrada." } as const;

    if (dados.cartaoOperadoraCartaoTaxaId) {
      // Escopado por empresa via a relação com Operadora — mesma proteção
      // cross-tenant já aplicada aos demais FKs escolhidos livremente pelo
      // usuário (ver auditoria multi-tenant).
      const taxa = await db.operadoraCartaoTaxa.findFirst({
        where: { id: dados.cartaoOperadoraCartaoTaxaId, operadoraId: dados.cartaoOperadoraId, operadora: { empresaId } },
      });
      if (!taxa) return { erro: "Taxa de operadora não encontrada." } as const;

      if (dados.cartaoTipoTaxa) {
        const percentualPorTipo: Record<string, Prisma.Decimal> = {
          a_vista: taxa.taxaAvista,
          antecipacao: taxa.taxaAntecipacao,
          parc_estabelecimento: taxa.taxaParcEstabelecimento,
          parc_cliente: taxa.taxaParcCliente,
        };
        percentualAplicado = percentualPorTipo[dados.cartaoTipoTaxa] ?? null;
      }
    }
  }
  // Despesa paga com cartão próprio: sem adquirente envolvido, só a
  // bandeira do cartão importa — Bandeira é catálogo global (sem
  // empresaId/grupoId), ver CLAUDE.md.
  if (dados.tipoDocumento === "cartao" && dados.tipo === "despesa" && dados.cartaoBandeiraId) {
    const bandeira = await db.bandeira.findFirst({ where: { id: dados.cartaoBandeiraId, ativo: true } });
    if (!bandeira) return { erro: "Bandeira não encontrada." } as const;
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
  if (planosValidos !== planoIds.length) {
    return { erro: "Uma ou mais contas do rateio de Plano Financeiro são inválidas." } as const;
  }

  const centroCustoIds = dados.rateioPlano.flatMap((l) => l.centroCusto.map((cc) => cc.centroCustoId));
  if (centroCustoIds.length > 0) {
    const centrosValidos = await db.centroCusto.count({
      where: { id: { in: centroCustoIds }, grupoId, natureza: "analitica", ativo: true },
    });
    if (centrosValidos !== centroCustoIds.length) {
      return { erro: "Uma ou mais contas do rateio de Centro de Custo são inválidas." } as const;
    }
  }

  const processoItemIds = dados.rateioProcesso.map((l) => l.processoItemId);
  const itensValidos = await db.processoItem.count({
    where: { id: { in: processoItemIds }, processoId: dados.processoId, natureza: "analitica", ativo: true },
  });
  if (itensValidos !== processoItemIds.length) {
    return { erro: "Um ou mais itens do rateio de Processo são inválidos." } as const;
  }

  if (dados.retencoes.length > 0) {
    const retencaoPlanoIds = dados.retencoes.map((r) => r.planoId);
    const retencaoPlanosValidos = await db.planoFinanceiro.count({
      where: { id: { in: retencaoPlanoIds }, grupoId, natureza: "analitica", ativo: true, permiteRetencao: true },
    });
    if (retencaoPlanosValidos !== retencaoPlanoIds.length) {
      return { erro: "Uma ou mais contas de retenção são inválidas." } as const;
    }
  }
  if (dados.comissoes.length > 0) {
    const vendedorIds = dados.comissoes.map((c) => c.vendedorId);
    const vendedoresValidos = await db.vendedor.count({ where: { id: { in: vendedorIds }, grupoId, ativo: true } });
    if (vendedoresValidos !== vendedorIds.length) return { erro: "Um ou mais vendedores de comissão são inválidos." } as const;
  }

  const valorOriginal = new Prisma.Decimal(dados.valorOriginal);
  const { rateioPlanoDistribuido, rateioProcessoDistribuido } = distribuirRateios(dados, valorOriginal);

  return { valorOriginal, rateioPlanoDistribuido, rateioProcessoDistribuido, percentualAplicado } as const;
}

type ResultadoValidacao = Awaited<ReturnType<typeof validarRegrasDeNegocio>>;
type ValidacaoOk = Extract<ResultadoValidacao, { valorOriginal: Prisma.Decimal }>;

/** Monta o objeto de dados (sem `empresaId`) para `create`/`update` do Lançamento, incluindo as relações aninhadas. */
function montarDadosPersistencia(dados: DadosLancamento, valores: ValidacaoOk) {
  const { valorOriginal, rateioPlanoDistribuido, rateioProcessoDistribuido } = valores;
  return {
    tipo: dados.tipo,
    natureza: dados.natureza,
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
    dataPrevisao: dados.dataPrevisao,
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
            terceiro: dados.chequeTerceiro || null,
          },
        }
      : undefined,
    dadosCartao:
      dados.tipoDocumento === "cartao"
        ? {
            create:
              dados.tipo === "receita"
                ? {
                    operadoraId: dados.cartaoOperadoraId || null,
                    operadoraCartaoTaxaId: dados.cartaoOperadoraCartaoTaxaId || null,
                    percentualAplicado: valores.percentualAplicado,
                    numeroCartao: dados.cartaoNumeroCartao || null,
                    numeroAutorizacao: dados.cartaoNumeroAutorizacao || null,
                    tipoTaxa: dados.cartaoTipoTaxa || null,
                  }
                : // Despesa: sem adquirente/taxa de repasse nessa direção —
                  // nunca preenche operadora/taxa/tipoTaxa/percentual com um
                  // valor "chute" só pra satisfazer o campo, ficam null.
                  {
                    bandeiraId: dados.cartaoBandeiraId || null,
                    numeroCartao: dados.cartaoNumeroCartao || null,
                  },
          }
        : undefined,
  };
}

/**
 * Núcleo de criação, sem FormData/redirect — usado pelo form normal
 * (`criarLancamentoFinanceiro`) e pela geração de Lançamentos Recorrentes
 * (`lancamentos-financeiros-recorrentes/actions.ts#gerarPendentes`), que já
 * monta um `DadosLancamento` a partir do template em vez de FormData. Nunca
 * move dinheiro nem grava no ledger — isso só acontece na Baixa
 * (`darBaixaLancamento`), mesmo espírito do estoque (um Lançamento de compra
 * só afeta o Kardex quando confirmado).
 */
export async function criarLancamentoFinanceiroDeDados(
  dados: DadosLancamento,
  ctx: { empresaId: string; grupoId: string; criadoPorId?: string; recorrenteId?: string }
): Promise<{ lancamentoId: string } | { erro: string }> {
  const validado = await validarRegrasDeNegocio(dados, ctx);
  if ("erro" in validado) return { erro: (validado as { erro: string }).erro };

  const ultimoFechamento = await obterUltimoFechamentoAtivo(db, ctx.empresaId);
  const dataMovimento = ultimoFechamento?.data ?? new Date();

  try {
    const lancamento = await db.lancamentoFinanceiro.create({
      data: {
        empresaId: ctx.empresaId,
        dataMovimento,
        criadoPorId: ctx.criadoPorId,
        recorrenteId: ctx.recorrenteId,
        ...montarDadosPersistencia(dados, validado),
      },
    });
    return { lancamentoId: lancamento.id };
  } catch {
    return { erro: "Não foi possível salvar o lançamento." };
  }
}

/**
 * Gera N Lançamentos Financeiros de uma vez (mesmo fornecedor/cliente, rateio,
 * processo etc. — só valor/vencimento/previsão variam), todos no mesmo
 * `grupoParcelamentoId`. Valor total dividido em partes iguais com o resíduo
 * de arredondamento concentrado na ÚLTIMA parcela (nunca perde/sobra
 * centavo); vencimento e previsão avançam um mês por parcela a partir do que
 * foi digitado pra 1ª (`adicionarMesesUTC`, clampado pro último dia real do
 * mês quando necessário). Uma única transação — tudo ou nada.
 */
async function criarLancamentoFinanceiroParcelado(
  dados: DadosLancamento,
  quantidadeParcelas: number,
  ctx: { empresaId: string; grupoId: string; criadoPorId?: string }
): Promise<{ primeiroLancamentoId: string } | { erro: string }> {
  const validado = await validarRegrasDeNegocio(dados, ctx);
  if ("erro" in validado) return { erro: (validado as { erro: string }).erro };

  const ultimoFechamento = await obterUltimoFechamentoAtivo(db, ctx.empresaId);
  const dataMovimento = ultimoFechamento?.data ?? new Date();

  const valorParcela = validado.valorOriginal.dividedBy(quantidadeParcelas).toDecimalPlaces(2);
  const diferenca = validado.valorOriginal.minus(valorParcela.times(quantidadeParcelas));

  const grupoParcelamentoId = crypto.randomUUID();

  try {
    const idsCriados = await db.$transaction(async (tx) => {
      const ids: string[] = [];
      for (let numero = 1; numero <= quantidadeParcelas; numero += 1) {
        const valorDestaParcela = numero === quantidadeParcelas ? valorParcela.plus(diferenca) : valorParcela;
        const valoresDaParcela: ValidacaoOk = {
          ...validado,
          valorOriginal: valorDestaParcela,
          ...distribuirRateios(dados, valorDestaParcela),
        };
        const lancamento = await tx.lancamentoFinanceiro.create({
          data: {
            empresaId: ctx.empresaId,
            dataMovimento,
            criadoPorId: ctx.criadoPorId,
            ...montarDadosPersistencia(dados, valoresDaParcela),
            dataVencimento: adicionarMesesUTC(dados.dataVencimento, numero - 1),
            dataPrevisao: adicionarMesesUTC(dados.dataPrevisao, numero - 1),
            grupoParcelamentoId,
            numeroParcela: numero,
            totalParcelas: quantidadeParcelas,
          },
        });
        ids.push(lancamento.id);
      }
      return ids;
    });
    return { primeiroLancamentoId: idsCriados[0] };
  } catch {
    return { erro: "Não foi possível salvar o lançamento parcelado." };
  }
}

export async function criarLancamentoFinanceiro(
  _prev: LancamentoFinanceiroFormState,
  formData: FormData
): Promise<LancamentoFinanceiroFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;
  const empresaId = permissao.session.user.empresaId!;
  const grupoId = permissao.session.user.grupoId!;

  const parsed = lerFormData(formData);
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const dados = parsed.data;

  if (dados.parcelado === "on" && dados.numeroParcelas) {
    const resultado = await criarLancamentoFinanceiroParcelado(dados, dados.numeroParcelas, {
      empresaId,
      grupoId,
      criadoPorId: permissao.session.user.id,
    });
    if ("erro" in resultado) return resultado;

    revalidatePath("/lancamentos-financeiros");
    redirect(`/lancamentos-financeiros/${resultado.primeiroLancamentoId}`);
  }

  const resultado = await criarLancamentoFinanceiroDeDados(dados, {
    empresaId,
    grupoId,
    criadoPorId: permissao.session.user.id,
  });
  if ("erro" in resultado) return resultado;

  revalidatePath("/lancamentos-financeiros");
  redirect(`/lancamentos-financeiros/${resultado.lancamentoId}`);
}

/** Atualiza um Lançamento Financeiro `aberto` — recria o rateio triplo do zero a partir do formulário. */
export async function atualizarLancamentoFinanceiro(
  lancamentoId: string,
  _prev: LancamentoFinanceiroFormState,
  formData: FormData
): Promise<LancamentoFinanceiroFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;
  const empresaId = permissao.session.user.empresaId!;
  const grupoId = permissao.session.user.grupoId!;

  const atual = await db.lancamentoFinanceiro.findFirst({ where: { id: lancamentoId, empresaId } });
  if (!atual) return { erro: "Lançamento não encontrado." };
  if (atual.status !== "aberto") return { erro: "Só é possível editar lançamentos em aberto." };

  const parsed = lerFormData(formData);
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const dados = parsed.data;

  if (dados.tipo !== atual.tipo) {
    return { erro: "Não é possível trocar Despesa/Receita depois de criado." };
  }

  const validado = await validarRegrasDeNegocio(dados, { empresaId, grupoId });
  if ("erro" in validado) return validado;

  try {
    await db.$transaction(async (tx) => {
      const travado = await tx.lancamentoFinanceiro.findUniqueOrThrow({ where: { id: lancamentoId } });
      if (travado.status !== "aberto") throw new Error("Só é possível editar lançamentos em aberto.");

      await tx.lancamentoRateio.deleteMany({ where: { lancamentoId } });
      await tx.lancamentoRateioProcesso.deleteMany({ where: { lancamentoId } });
      await tx.retencao.deleteMany({ where: { lancamentoId } });
      await tx.comissao.deleteMany({ where: { lancamentoId } });
      await tx.dadosCheque.deleteMany({ where: { lancamentoId } });
      await tx.dadosCartao.deleteMany({ where: { lancamentoId } });

      await tx.lancamentoFinanceiro.update({
        where: { id: lancamentoId },
        data: {
          ...montarDadosPersistencia(dados, validado),
          atualizadoEm: new Date(),
          atualizadoPorId: permissao.session.user.id,
        },
      });
    });
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Não foi possível salvar as alterações." };
  }

  revalidatePath("/lancamentos-financeiros");
  revalidatePath(`/lancamentos-financeiros/${lancamentoId}`);
  redirect(`/lancamentos-financeiros/${lancamentoId}`);
}

/** Converte uma `prevista` em `real`, liberando-a para Baixa — snapshot de `dataMovimento` refeito na hora da confirmação. */
export async function confirmarPrevisao(
  lancamentoId: string,
  _prev: LancamentoFinanceiroFormState,
  _formData: FormData
): Promise<LancamentoFinanceiroFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;
  const empresaId = permissao.session.user.empresaId!;

  const lancamento = await db.lancamentoFinanceiro.findFirst({ where: { id: lancamentoId, empresaId } });
  if (!lancamento) return { erro: "Lançamento não encontrado." };
  if (lancamento.status !== "aberto") return { erro: "Só é possível confirmar previsões em aberto." };
  if (lancamento.natureza !== "prevista") return { erro: "Este lançamento já é real." };

  const ultimoFechamento = await obterUltimoFechamentoAtivo(db, empresaId);
  const dataMovimento = ultimoFechamento?.data ?? new Date();

  await db.lancamentoFinanceiro.update({
    where: { id: lancamentoId },
    data: { natureza: "real", convertidoEm: new Date(), dataMovimento },
  });

  revalidatePath("/lancamentos-financeiros");
  revalidatePath(`/lancamentos-financeiros/${lancamentoId}`);
  return {};
}

const dataPrevisaoSchema = z.object({ dataPrevisao: z.coerce.date({ message: "Informe a data de previsão." }) });

/**
 * Edita só a Data de Previsão — deliberadamente FORA da trava de Fechamento
 * Diário que vale para dataEmissao/dataVencimento/valor (nunca chama
 * `validarDataDeMovimento`/`obterUltimoFechamentoAtivo` aqui): é só um
 * apontamento de expectativa de pagamento/recebimento, editável livremente
 * enquanto o título está `aberto`, e travada assim que sai desse status
 * (baixado, estornado, renegociado, cancelado).
 */
export async function atualizarDataPrevisao(
  lancamentoId: string,
  _prev: LancamentoFinanceiroFormState,
  formData: FormData
): Promise<LancamentoFinanceiroFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;
  const empresaId = permissao.session.user.empresaId!;

  const parsed = dataPrevisaoSchema.safeParse({ dataPrevisao: formData.get("dataPrevisao") });
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Data inválida." };

  const lancamento = await db.lancamentoFinanceiro.findFirst({ where: { id: lancamentoId, empresaId } });
  if (!lancamento) return { erro: "Lançamento não encontrado." };
  if (lancamento.status !== "aberto") {
    return { erro: "Não é possível alterar a data de previsão de um título que já foi baixado, estornado, renegociado ou cancelado." };
  }

  await db.lancamentoFinanceiro.update({
    where: { id: lancamentoId },
    data: { dataPrevisao: parsed.data.dataPrevisao },
  });

  revalidatePath(`/lancamentos-financeiros/${lancamentoId}`);
  return {};
}

/**
 * Exclui um Lançamento Financeiro — só permitido pra uma `prevista` em aberto
 * (nunca teve Baixa, então não há ledger nem saldo de conta a desfazer). Um
 * lançamento `real` nunca é excluído, só cancelado/estornado.
 */
export async function excluirLancamentoFinanceiro(
  lancamentoId: string,
  _prev: LancamentoFinanceiroFormState,
  _formData: FormData
): Promise<LancamentoFinanceiroFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;
  const empresaId = permissao.session.user.empresaId!;

  const lancamento = await db.lancamentoFinanceiro.findFirst({ where: { id: lancamentoId, empresaId } });
  if (!lancamento) return { erro: "Lançamento não encontrado." };
  if (lancamento.natureza !== "prevista") return { erro: "Só é possível excluir lançamentos classificados como Previsão." };
  if (lancamento.status !== "aberto") return { erro: "Só é possível excluir lançamentos em aberto." };

  try {
    await db.$transaction(async (tx) => {
      const travado = await tx.lancamentoFinanceiro.findUniqueOrThrow({ where: { id: lancamentoId } });
      if (travado.natureza !== "prevista" || travado.status !== "aberto") {
        throw new Error("Só é possível excluir lançamentos classificados como Previsão, em aberto.");
      }

      await tx.retencao.deleteMany({ where: { lancamentoId } });
      await tx.comissao.deleteMany({ where: { lancamentoId } });
      await tx.dadosCheque.deleteMany({ where: { lancamentoId } });
      await tx.dadosCartao.deleteMany({ where: { lancamentoId } });
      await tx.lancamentoFinanceiro.delete({ where: { id: lancamentoId } });
    });
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Não foi possível excluir o lançamento." };
  }

  revalidatePath("/lancamentos-financeiros");
  redirect("/lancamentos-financeiros");
}

const cancelarSchema = z.object({
  escopo: z.enum(["apenas_esta", "todas_pendentes"]),
  motivo: z.string().trim().min(1, "Informe o motivo do cancelamento."),
});

/**
 * Cancela um Lançamento Financeiro — NUNCA um DELETE físico, sempre
 * `status: aberto -> cancelado` (histórico/auditoria preservados). Só
 * permitido a partir de `aberto`: um título já baixado se reverte por
 * Estorno, não por cancelamento. Quando o título pertence a um grupo de
 * parcelamento, `escopo: "todas_pendentes"` cancela em lote todas as
 * parcelas do mesmo grupo que ainda estão `aberto` — nunca mexe em parcelas
 * já baixadas/estornadas do mesmo grupo.
 */
export async function cancelarLancamentoFinanceiro(
  lancamentoId: string,
  _prev: LancamentoFinanceiroFormState,
  formData: FormData
): Promise<LancamentoFinanceiroFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;
  const empresaId = permissao.session.user.empresaId!;

  const parsed = cancelarSchema.safeParse({ escopo: formData.get("escopo"), motivo: formData.get("motivo") });
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const { escopo, motivo } = parsed.data;

  const lancamento = await db.lancamentoFinanceiro.findFirst({ where: { id: lancamentoId, empresaId } });
  if (!lancamento) return { erro: "Lançamento não encontrado." };
  if (lancamento.status !== "aberto") {
    return { erro: "Só é possível cancelar um título com status aberto. Para reverter um título já baixado, use o Estorno." };
  }

  const dadosCancelamento = {
    status: "cancelado" as const,
    motivoCancelamento: motivo,
    canceladoEm: new Date(),
    canceladoPorId: permissao.session.user.id,
  };

  if (escopo === "apenas_esta" || !lancamento.grupoParcelamentoId) {
    await db.lancamentoFinanceiro.update({ where: { id: lancamentoId }, data: dadosCancelamento });
  } else {
    await db.lancamentoFinanceiro.updateMany({
      where: { grupoParcelamentoId: lancamento.grupoParcelamentoId, status: "aberto", empresaId },
      data: dadosCancelamento,
    });
  }

  revalidatePath("/lancamentos-financeiros");
  revalidatePath(`/lancamentos-financeiros/${lancamentoId}`);
  return {};
}

const baixaSchema = z.object({
  contaId: z.string().min(1, "Selecione a conta."),
  dataBaixa: z.coerce.date({ message: "Informe a data da baixa." }),
  juros: z.coerce.number().nonnegative("Juros não pode ser negativo.").optional(),
  multa: z.coerce.number().nonnegative("Multa não pode ser negativa.").optional(),
  desconto: z.coerce.number().nonnegative("Desconto não pode ser negativo.").optional(),
  historicoComplementar: z.string().trim().transform(normalizarTexto).optional(),
  chequeBaixaIds: z.array(z.string().min(1)),
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
  if (lancamento.natureza === "prevista") return { erro: "Confirme a previsão antes de dar baixa." };

  const parsed = baixaSchema.safeParse({
    contaId: formData.get("contaId"),
    dataBaixa: formData.get("dataBaixa"),
    juros: formData.get("juros") || undefined,
    multa: formData.get("multa") || undefined,
    desconto: formData.get("desconto") || undefined,
    historicoComplementar: formData.get("historicoComplementar"),
    chequeBaixaIds: formData.getAll("chequeBaixaIds"),
  });
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const conta = await db.contaFinanceira.findFirst({ where: { id: parsed.data.contaId, empresaId } });
  if (!conta) return { erro: "Conta financeira não encontrada." };

  const erroConta = erroContaParaBaixa(conta, { tipoLancamento: lancamento.tipo, tipoDocumento: lancamento.tipoDocumento });
  if (erroConta) return { erro: erroConta };

  // O terceiro do adiantamento nunca é escolhido na Baixa — é sempre o
  // cliente/fornecedor já definido no próprio Lançamento (contraparte
  // obrigatória conforme o tipo, ver criarLancamentoFinanceiro).
  const exigeCliente = lancamento.tipo === "receita" && conta.adiantamentoCliente;
  const exigeFornecedor = lancamento.tipo === "despesa" && conta.adiantamentoFornecedor;
  if (exigeCliente && !lancamento.clienteId) return { erro: "Este lançamento não tem cliente definido." };
  if (exigeFornecedor && !lancamento.fornecedorId) return { erro: "Este lançamento não tem fornecedor definido." };

  // Pagar uma despesa repassando cheque(s) de terceiro só existe quando os
  // dois lados transitam pelo Caixa — ver src/lib/kardex.ts... não, ver
  // regra ditada pelo usuário: título (cheque) já baixado no Caixa vinculado
  // a uma despesa também baixada no Caixa.
  if (parsed.data.chequeBaixaIds.length > 0) {
    if (lancamento.tipo !== "despesa") return { erro: "Vínculo de cheque de terceiro só se aplica a despesas." };
    if (conta.tipo !== "caixa") return { erro: "Vínculo de cheque de terceiro só se aplica quando a baixa é feita no Caixa." };
  }

  try {
    await db.$transaction(async (tx) => {
      const { baixa } = await registrarBaixaNaTransacao(tx, {
        lancamentoId,
        contaId: parsed.data.contaId,
        dataBaixa: parsed.data.dataBaixa,
        juros: new Prisma.Decimal(parsed.data.juros ?? 0),
        multa: new Prisma.Decimal(parsed.data.multa ?? 0),
        desconto: new Prisma.Decimal(parsed.data.desconto ?? 0),
        historicoComplementar: parsed.data.historicoComplementar,
        usuarioId: permissao.session.user.id,
        adiantamentoClienteId: exigeCliente ? lancamento.clienteId! : undefined,
        adiantamentoFornecedorId: exigeFornecedor ? lancamento.fornecedorId! : undefined,
      });

      if (parsed.data.chequeBaixaIds.length > 0) {
        const cheques = await tx.baixa.findMany({
          where: {
            id: { in: parsed.data.chequeBaixaIds },
            estornada: false,
            utilizadoComoChequeEm: null,
            conta: { tipo: "caixa" },
            lancamento: { empresaId, tipo: "receita", tipoDocumento: { in: ["cheque_vista", "cheque_prazo"] } },
          },
        });
        if (cheques.length !== parsed.data.chequeBaixaIds.length) {
          throw new Error("Um ou mais cheques selecionados não estão mais disponíveis.");
        }
        const totalCheques = cheques.reduce((acc, c) => acc.plus(c.valorBaixado), new Prisma.Decimal(0));
        if (totalCheques.greaterThan(baixa.valorBaixado)) {
          throw new Error("A soma dos cheques selecionados não pode ser maior que o valor da baixa.");
        }
        await tx.chequeTerceiroUtilizado.createMany({
          data: cheques.map((c) => ({ baixaDespesaId: baixa.id, baixaChequeId: c.id })),
        });
      }
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

  const ehCheque = lancamento.tipoDocumento.startsWith("cheque_");
  if (!ehCheque && parsed.data.contaId !== baixaAtiva.contaId) {
    return { erro: "Só é possível trocar a conta em estorno de cheque." };
  }

  const conta = await db.contaFinanceira.findFirst({ where: { id: parsed.data.contaId, empresaId } });
  if (!conta) return { erro: "Conta financeira não encontrada." };

  // Se essa baixa é ela mesma um cheque de terceiro já repassado pra pagar
  // uma despesa, não dá pra estornar por aqui — estornaria o recebimento
  // debaixo do pagamento que já foi feito com ele. Estorna a despesa primeiro.
  const usadoComoCheque = await db.chequeTerceiroUtilizado.findUnique({ where: { baixaChequeId: baixaAtiva.id } });
  if (usadoComoCheque) {
    return { erro: "Este cheque já foi repassado pra pagar uma despesa — estorne a baixa da despesa primeiro." };
  }

  try {
    await db.$transaction(async (tx) => {
      await registrarEstornoNaTransacao(tx, {
        baixaId: baixaAtiva.id,
        contaId: parsed.data.contaId,
        motivo: parsed.data.motivo,
        dataEstorno: parsed.data.dataEstorno,
        alineaDevolucaoId: ehCheque ? parsed.data.alineaDevolucaoId : undefined,
      });
      // Libera de volta o(s) cheque(s) que essa despesa tinha usado — podem
      // ser vinculados de novo numa próxima baixa deste mesmo lançamento.
      await tx.chequeTerceiroUtilizado.deleteMany({ where: { baixaDespesaId: baixaAtiva.id } });
    });
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Não foi possível estornar a baixa." };
  }

  revalidatePath("/lancamentos-financeiros");
  revalidatePath(`/lancamentos-financeiros/${lancamentoId}`);
  redirect(`/lancamentos-financeiros/${lancamentoId}`);
}
