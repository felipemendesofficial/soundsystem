"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { normalizarTexto } from "@/lib/texto";
import { obterUltimoFechamentoAtivo } from "@/lib/financeiro-ledger";
import { consolidarRateioOrigens, calcularRateioHerdado } from "@/lib/renegociacao";

export type RenegociacaoFormState = { erro?: string };

async function exigirPermissao() {
  const session = await auth();
  if (!session?.user) return { erro: "Não autenticado." } as const;
  if (!podeGerenciarFinanceiro(session.user.perfil)) {
    return { erro: "Seu perfil não pode gerenciar o Financeiro." } as const;
  }
  return { session } as const;
}

const destinoSchema = z.object({
  descricao: z.string().trim().min(1, "Informe o histórico do título de destino.").transform(normalizarTexto),
  clienteId: z.string().trim().optional(),
  fornecedorId: z.string().trim().optional(),
  tipoDocumento: z.enum([
    "especie", "cheque_vista", "cheque_prazo", "cheque_devolvido", "deposito_cartorio",
    "nota_promissoria", "deposito_bancario", "pix", "cartao",
  ], { message: "Selecione o tipo de documento." }),
  processoId: z.string().min(1, "Selecione o processo."),
  processoItemId: z.string().min(1, "Selecione o item do processo."),
  dataEmissao: z.coerce.date({ message: "Informe a data de emissão." }),
  dataVencimento: z.coerce.date({ message: "Informe a data de vencimento." }),
  valorOriginal: z.coerce.number().positive("Valor deve ser maior que zero."),
  juros: z.coerce.number().nonnegative().default(0),
  multa: z.coerce.number().nonnegative().default(0),
  desconto: z.coerce.number().nonnegative().default(0),
  justificativaDesconto: z.string().trim().optional(),
});

const renegociacaoSchema = z.object({
  tipo: z.enum(["receita", "despesa"], { message: "Selecione o tipo." }),
  motivo: z.string().trim().min(1, "Informe o motivo.").transform(normalizarTexto),
  origensIds: z.array(z.string().min(1)).min(1, "Selecione ao menos um título de origem."),
  destinos: z
    .string()
    .transform((valor, ctx) => {
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(valor);
      } catch {
        ctx.addIssue({ code: "custom", message: "Destinos inválidos." });
        return z.NEVER;
      }
      const resultado = z.array(destinoSchema).min(1, "Adicione ao menos um título de destino.").safeParse(parsedJson);
      if (!resultado.success) {
        ctx.addIssue({ code: "custom", message: resultado.error.issues[0]?.message ?? "Destinos inválidos." });
        return z.NEVER;
      }
      return resultado.data;
    }),
});

/** Cadastra uma Renegociação: fecha os títulos de origem (status `renegociado`, sem baixa/movimentação de conta) e cria os títulos de destino com o rateio herdado proporcionalmente. */
export async function criarRenegociacao(_prev: RenegociacaoFormState, formData: FormData): Promise<RenegociacaoFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;
  const empresaId = permissao.session.user.empresaId!;
  const usuarioId = permissao.session.user.id;

  const parsed = renegociacaoSchema.safeParse({
    tipo: formData.get("tipo"),
    motivo: formData.get("motivo"),
    origensIds: formData.getAll("origensIds"),
    destinos: formData.get("destinos"),
  });
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const dados = parsed.data;

  for (const destino of dados.destinos) {
    if (dados.tipo === "despesa") {
      if (!destino.fornecedorId) return { erro: "Selecione o fornecedor de cada título de destino." };
      if (destino.clienteId) return { erro: "Um destino de despesa não pode ter cliente." };
    } else {
      if (!destino.clienteId) return { erro: "Selecione o cliente de cada título de destino." };
      if (destino.fornecedorId) return { erro: "Um destino de receita não pode ter fornecedor." };
    }
    if (destino.dataVencimento < destino.dataEmissao) return { erro: "Vencimento não pode ser anterior à emissão em um dos destinos." };
    if (destino.desconto > 0 && !destino.justificativaDesconto) {
      return { erro: "Informe a justificativa do desconto em todo título de destino com desconto." };
    }
  }

  const origens = await db.lancamentoFinanceiro.findMany({
    where: { id: { in: dados.origensIds }, empresaId, status: "aberto", tipo: dados.tipo },
    include: { rateios: { include: { rateiosCentroCusto: true } } },
  });
  if (origens.length !== dados.origensIds.length) {
    return { erro: "Um ou mais títulos de origem não foram encontrados, não estão abertos, ou não são do mesmo tipo." };
  }

  const totalOrigem = origens.reduce((acc, o) => acc.plus(o.valorOriginal), new Prisma.Decimal(0));
  const totalDestinosBruto = dados.destinos.reduce((acc, d) => acc + d.valorOriginal, 0);
  const ajusteEsperado = dados.destinos.reduce((acc, d) => acc + d.juros + d.multa - d.desconto, 0);
  if (Math.abs(totalDestinosBruto - (Number(totalOrigem) + ajusteEsperado)) > 0.01) {
    return {
      erro: `A soma dos títulos de destino (${totalDestinosBruto.toFixed(2)}) precisa ser igual à soma das origens mais juros/multa menos desconto (${(Number(totalOrigem) + ajusteEsperado).toFixed(2)}).`,
    };
  }

  const processoIds = [...new Set(dados.destinos.map((d) => d.processoId))];
  const processosValidos = await db.processo.count({ where: { id: { in: processoIds }, empresaId } });
  if (processosValidos !== processoIds.length) return { erro: "Um ou mais processos de destino são inválidos." };

  const processoItemIds = dados.destinos.map((d) => d.processoItemId);
  const itensValidos = await db.processoItem.count({ where: { id: { in: processoItemIds }, natureza: "analitica", ativo: true } });
  if (itensValidos !== processoItemIds.length) return { erro: "Um ou mais itens de processo de destino são inválidos." };

  const consolidado = consolidarRateioOrigens(origens.map((o) => o.rateios));

  try {
    await db.$transaction(async (tx) => {
      const ultimoFechamento = await obterUltimoFechamentoAtivo(tx, empresaId);
      const dataMovimento = ultimoFechamento?.data ?? new Date();

      const renegociacao = await tx.renegociacao.create({
        data: { empresaId, tipo: dados.tipo, motivo: dados.motivo, criadoPorId: usuarioId },
      });

      for (const origem of origens) {
        await tx.lancamentoFinanceiro.update({ where: { id: origem.id }, data: { status: "renegociado" } });
        await tx.renegociacaoOrigem.create({ data: { renegociacaoId: renegociacao.id, lancamentoId: origem.id } });
      }

      for (const destino of dados.destinos) {
        const valorDestino = new Prisma.Decimal(destino.valorOriginal);
        const rateioHerdado = calcularRateioHerdado(consolidado, totalOrigem, valorDestino);

        // Agrupa por planoId antes de gravar — `calcularRateioHerdado` devolve
        // uma linha por combinação (planoId, centroCustoId); um mesmo plano
        // dividido entre vários centros de custo precisa virar UM
        // LancamentoRateio (não vários, que bateria no @@unique([lancamentoId, planoId])),
        // com os centros como filhos aninhados.
        const porPlano = new Map<string, { valor: Prisma.Decimal; centros: { centroCustoId: string; valor: Prisma.Decimal }[] }>();
        for (const r of rateioHerdado) {
          const atual = porPlano.get(r.planoId) ?? { valor: new Prisma.Decimal(0), centros: [] };
          atual.valor = atual.valor.plus(r.valor);
          if (r.centroCustoId) atual.centros.push({ centroCustoId: r.centroCustoId, valor: r.valor });
          porPlano.set(r.planoId, atual);
        }

        const lancamentoDestino = await tx.lancamentoFinanceiro.create({
          data: {
            empresaId,
            dataMovimento,
            criadoPorId: usuarioId,
            tipo: dados.tipo,
            natureza: "real",
            historicoSimplificado: destino.descricao,
            tipoDocumento: destino.tipoDocumento,
            clienteId: destino.clienteId || null,
            fornecedorId: destino.fornecedorId || null,
            valorOriginal: valorDestino,
            dataEmissao: destino.dataEmissao,
            dataVencimento: destino.dataVencimento,
            processoId: destino.processoId,
            observacao: `Gerado por renegociação — ${dados.motivo}`,
            rateios: {
              create: Array.from(porPlano.entries()).map(([planoId, { valor, centros }]) => ({
                planoId,
                percentual: valor.dividedBy(valorDestino).times(100).toDecimalPlaces(2),
                valor,
                rateiosCentroCusto:
                  centros.length > 0
                    ? {
                        create: centros.map((c) => ({
                          centroCustoId: c.centroCustoId,
                          percentual: c.valor.dividedBy(valor).times(100).toDecimalPlaces(2),
                          valor: c.valor,
                        })),
                      }
                    : undefined,
              })),
            },
            rateiosProcesso: {
              create: [{ processoItemId: destino.processoItemId, percentual: new Prisma.Decimal(100), valor: valorDestino }],
            },
          },
        });

        await tx.renegociacaoDestino.create({
          data: {
            renegociacaoId: renegociacao.id,
            lancamentoId: lancamentoDestino.id,
            juros: new Prisma.Decimal(destino.juros),
            multa: new Prisma.Decimal(destino.multa),
            desconto: new Prisma.Decimal(destino.desconto),
            justificativaDesconto: destino.justificativaDesconto || null,
          },
        });
      }

      return renegociacao;
    });
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Não foi possível salvar a renegociação." };
  }

  revalidatePath("/renegociacoes");
  revalidatePath("/lancamentos-financeiros");
  redirect("/renegociacoes");
}
