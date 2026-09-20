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
import { chaveAgrupamentoTerceiro } from "@/lib/cnpj";

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

const creditoUsadoSchema = z.object({
  creditoDevolucaoId: z.string().min(1),
  valor: z.coerce.number().positive(),
});

const renegociacaoSchema = z.object({
  tipo: z.enum(["receita", "despesa"], { message: "Selecione o tipo." }),
  motivo: z.string().trim().min(1, "Informe o motivo.").transform(normalizarTexto),
  origensIds: z.array(z.string().min(1)).min(1, "Selecione ao menos um título de origem."),
  destinos: z.string().transform((valor, ctx) => {
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
  creditosUsados: z.string().transform((valor, ctx) => {
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(valor);
    } catch {
      ctx.addIssue({ code: "custom", message: "Créditos inválidos." });
      return z.NEVER;
    }
    const resultado = z.array(creditoUsadoSchema).safeParse(parsedJson);
    if (!resultado.success) {
      ctx.addIssue({ code: "custom", message: "Créditos inválidos." });
      return z.NEVER;
    }
    return resultado.data;
  }),
});

/**
 * Cria a Renegociação como RASCUNHO (`status: aberta`) — nada é
 * reclassificado ainda: origens continuam `aberto`, destinos existem só
 * como dado bruto em `RenegociacaoDestino` (sem `LancamentoFinanceiro`
 * próprio). A reclassificação de verdade só acontece em `fecharRenegociacao`.
 */
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
    creditosUsados: formData.get("creditosUsados"),
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

  // Só títulos abertos e não reservados por outro rascunho (renegociação
  // `aberta`) — uma vez `fechada`, o próprio status do título já vira
  // `renegociado` e sai do universo de "aberto" sozinho.
  const origens = await db.lancamentoFinanceiro.findMany({
    where: {
      id: { in: dados.origensIds },
      empresaId,
      status: "aberto",
      tipo: dados.tipo,
      renegociacoesOrigem: { none: { renegociacao: { status: "aberta" } } },
    },
    include: {
      rateios: { include: { rateiosCentroCusto: true } },
      cliente: true,
      fornecedor: true,
    },
  });
  if (origens.length !== dados.origensIds.length) {
    return { erro: "Um ou mais títulos de origem não foram encontrados, não estão abertos, não são do mesmo tipo, ou já estão reservados por outra renegociação em aberto." };
  }

  // Mesmo fornecedor/cliente, ou mesmo radical de CNPJ — origens e destinos
  // juntos, já que a renegociação deve manter a mesma contraparte (ou
  // filiais da mesma empresa) do início ao fim.
  const chaves = new Set<string>();
  for (const o of origens) {
    const terceiro = o.cliente ?? o.fornecedor;
    if (!terceiro) return { erro: "Título de origem sem cliente/fornecedor definido." };
    chaves.add(chaveAgrupamentoTerceiro(terceiro.id, terceiro.documento ?? null));
  }

  const clienteIds = [...new Set(dados.destinos.map((d) => d.clienteId).filter((v): v is string => !!v))];
  const fornecedorIds = [...new Set(dados.destinos.map((d) => d.fornecedorId).filter((v): v is string => !!v))];
  const [clientesDestino, fornecedoresDestino] = await Promise.all([
    clienteIds.length > 0 ? db.cliente.findMany({ where: { id: { in: clienteIds } } }) : Promise.resolve([]),
    fornecedorIds.length > 0 ? db.fornecedor.findMany({ where: { id: { in: fornecedorIds } } }) : Promise.resolve([]),
  ]);
  for (const destino of dados.destinos) {
    const terceiro = destino.clienteId
      ? clientesDestino.find((c) => c.id === destino.clienteId)
      : fornecedoresDestino.find((f) => f.id === destino.fornecedorId);
    if (!terceiro) return { erro: "Cliente/fornecedor de um título de destino não encontrado." };
    chaves.add(chaveAgrupamentoTerceiro(terceiro.id, terceiro.documento ?? null));
  }
  if (chaves.size > 1) {
    return { erro: "Todos os títulos (origem e destino) precisam ser do mesmo fornecedor/cliente, ou de filiais com o mesmo radical de CNPJ." };
  }

  const totalOrigem = origens.reduce((acc, o) => acc.plus(o.valorOriginal), new Prisma.Decimal(0));
  const totalDestinosBruto = dados.destinos.reduce((acc, d) => acc + d.valorOriginal, 0);
  const ajusteEsperado = dados.destinos.reduce((acc, d) => acc + d.juros + d.multa - d.desconto, 0);
  const totalCreditoUsado = dados.creditosUsados.reduce((acc, c) => acc + c.valor, 0);
  if (Math.abs(totalDestinosBruto - (Number(totalOrigem) + ajusteEsperado - totalCreditoUsado)) > 0.01) {
    return {
      erro: `A soma dos títulos de destino (${totalDestinosBruto.toFixed(2)}) precisa ser igual à soma das origens mais juros/multa menos desconto menos crédito usado (${(Number(totalOrigem) + ajusteEsperado - totalCreditoUsado).toFixed(2)}).`,
    };
  }

  const processoIds = [...new Set(dados.destinos.map((d) => d.processoId))];
  const processosValidos = await db.processo.count({ where: { id: { in: processoIds }, empresaId } });
  if (processosValidos !== processoIds.length) return { erro: "Um ou mais processos de destino são inválidos." };

  const processoItemIds = [...new Set(dados.destinos.map((d) => d.processoItemId))];
  const itensValidos = await db.processoItem.count({ where: { id: { in: processoItemIds }, natureza: "analitica", ativo: true } });
  if (itensValidos !== processoItemIds.length) return { erro: "Um ou mais itens de processo de destino são inválidos." };

  // Créditos: precisam ser da mesma chave de agrupamento e ter saldo
  // suficiente já descontando o que outros rascunhos em aberto já reservaram
  // (a dedução de verdade em saldoDisponivel só acontece no Fechar).
  if (dados.creditosUsados.length > 0) {
    const creditoIds = dados.creditosUsados.map((c) => c.creditoDevolucaoId);
    const creditos = await db.creditoDevolucao.findMany({
      where: { id: { in: creditoIds }, empresaId },
      include: { cliente: true, fornecedor: true, usos: { where: { renegociacao: { status: "aberta" } } } },
    });
    if (creditos.length !== creditoIds.length) return { erro: "Um ou mais créditos de devolução não foram encontrados." };

    for (const credito of dados.creditosUsados) {
      const c = creditos.find((x) => x.id === credito.creditoDevolucaoId)!;
      const terceiro = c.cliente ?? c.fornecedor;
      if (!terceiro || !chaves.has(chaveAgrupamentoTerceiro(terceiro.id, terceiro.documento ?? null))) {
        return { erro: "Um dos créditos de devolução não é do mesmo fornecedor/cliente (ou radical de CNPJ) desta renegociação." };
      }
      const reservadoPorOutrosRascunhos = c.usos.reduce((acc, u) => acc.plus(u.valorUtilizado), new Prisma.Decimal(0));
      const efetivamenteDisponivel = c.saldoDisponivel.minus(reservadoPorOutrosRascunhos);
      if (new Prisma.Decimal(credito.valor).greaterThan(efetivamenteDisponivel)) {
        return { erro: `O crédito de devolução de ${terceiro.nome} só tem ${efetivamenteDisponivel.toFixed(2)} disponível.` };
      }
    }
  }

  const renegociacao = await db.$transaction(async (tx) => {
    const nova = await tx.renegociacao.create({
      data: { empresaId, tipo: dados.tipo, motivo: dados.motivo, criadoPorId: usuarioId, status: "aberta" },
    });

    await tx.renegociacaoOrigem.createMany({
      data: origens.map((o) => ({ renegociacaoId: nova.id, lancamentoId: o.id })),
    });

    await tx.renegociacaoDestino.createMany({
      data: dados.destinos.map((d) => ({
        renegociacaoId: nova.id,
        historicoSimplificado: d.descricao,
        clienteId: d.clienteId || null,
        fornecedorId: d.fornecedorId || null,
        tipoDocumento: d.tipoDocumento,
        processoId: d.processoId,
        processoItemId: d.processoItemId,
        dataEmissao: d.dataEmissao,
        dataVencimento: d.dataVencimento,
        valorOriginal: new Prisma.Decimal(d.valorOriginal),
        juros: new Prisma.Decimal(d.juros),
        multa: new Prisma.Decimal(d.multa),
        desconto: new Prisma.Decimal(d.desconto),
        justificativaDesconto: d.justificativaDesconto || null,
      })),
    });

    if (dados.creditosUsados.length > 0) {
      await tx.creditoDevolucaoUtilizado.createMany({
        data: dados.creditosUsados.map((c) => ({
          renegociacaoId: nova.id,
          creditoDevolucaoId: c.creditoDevolucaoId,
          valorUtilizado: new Prisma.Decimal(c.valor),
        })),
      });
    }

    return nova;
  });

  revalidatePath("/renegociacoes");
  redirect(`/renegociacoes/${renegociacao.id}`);
}

/** Efetiva a Renegociação: reclassifica origens (`renegociado`), cria os títulos de destino de verdade e debita os créditos usados. Reconfere tudo antes, já que o rascunho pode ter ficado parado um tempo. */
export async function fecharRenegociacao(id: string): Promise<RenegociacaoFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;
  const empresaId = permissao.session.user.empresaId!;
  const usuarioId = permissao.session.user.id;

  const renegociacao = await db.renegociacao.findFirst({
    where: { id, empresaId },
    include: {
      origens: { include: { lancamento: { include: { rateios: { include: { rateiosCentroCusto: true } } } } } },
      destinos: true,
      creditosUsados: { include: { creditoDevolucao: true } },
    },
  });
  if (!renegociacao) return { erro: "Renegociação não encontrada." };
  if (renegociacao.status !== "aberta") return { erro: "Só é possível fechar uma renegociação em rascunho (aberta)." };

  for (const origem of renegociacao.origens) {
    if (origem.lancamento.status !== "aberto") {
      return { erro: `O título "${origem.lancamento.historicoSimplificado}" não está mais em aberto — não é possível fechar esta renegociação.` };
    }
  }
  for (const usado of renegociacao.creditosUsados) {
    if (usado.creditoDevolucao.saldoDisponivel.lessThan(usado.valorUtilizado)) {
      return { erro: "Um dos créditos de devolução não tem mais saldo suficiente — foi consumido em outra renegociação enquanto este rascunho ficava aberto." };
    }
  }

  const totalOrigem = renegociacao.origens.reduce((acc, o) => acc.plus(o.lancamento.valorOriginal), new Prisma.Decimal(0));
  const consolidado = consolidarRateioOrigens(renegociacao.origens.map((o) => o.lancamento.rateios));

  try {
    await db.$transaction(async (tx) => {
      const ultimoFechamento = await obterUltimoFechamentoAtivo(tx, empresaId);
      const dataMovimento = ultimoFechamento?.data ?? new Date();

      for (const origem of renegociacao.origens) {
        await tx.lancamentoFinanceiro.update({ where: { id: origem.lancamentoId }, data: { status: "renegociado" } });
      }

      for (const destino of renegociacao.destinos) {
        const valorDestino = destino.valorOriginal;
        const rateioHerdado = calcularRateioHerdado(consolidado, totalOrigem, valorDestino);

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
            tipo: renegociacao.tipo,
            natureza: "real",
            historicoSimplificado: destino.historicoSimplificado,
            tipoDocumento: destino.tipoDocumento,
            clienteId: destino.clienteId,
            fornecedorId: destino.fornecedorId,
            valorOriginal: valorDestino,
            dataEmissao: destino.dataEmissao,
            dataVencimento: destino.dataVencimento,
            processoId: destino.processoId,
            observacao: `Gerado por renegociação — ${renegociacao.motivo}`,
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

        await tx.renegociacaoDestino.update({ where: { id: destino.id }, data: { lancamentoId: lancamentoDestino.id } });
      }

      for (const usado of renegociacao.creditosUsados) {
        await tx.creditoDevolucao.update({
          where: { id: usado.creditoDevolucaoId },
          data: { saldoDisponivel: { decrement: usado.valorUtilizado } },
        });
      }

      await tx.renegociacao.update({ where: { id }, data: { status: "fechada", fechadoEm: new Date() } });
    });
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Não foi possível fechar a renegociação." };
  }

  revalidatePath("/renegociacoes");
  revalidatePath(`/renegociacoes/${id}`);
  revalidatePath("/lancamentos-financeiros");
  return {};
}

/** Descarta o rascunho — nada foi reclassificado ainda, só libera os títulos/créditos reservados. */
export async function cancelarRenegociacao(id: string): Promise<RenegociacaoFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;
  const empresaId = permissao.session.user.empresaId!;

  const renegociacao = await db.renegociacao.findFirst({ where: { id, empresaId } });
  if (!renegociacao) return { erro: "Renegociação não encontrada." };
  if (renegociacao.status !== "aberta") return { erro: "Só é possível cancelar uma renegociação em rascunho (aberta)." };

  await db.$transaction(async (tx) => {
    await tx.creditoDevolucaoUtilizado.deleteMany({ where: { renegociacaoId: id } });
    await tx.renegociacao.update({ where: { id }, data: { status: "cancelada" } });
  });

  revalidatePath("/renegociacoes");
  revalidatePath(`/renegociacoes/${id}`);
  return {};
}

/** Reverte uma renegociação fechada — só se nenhum título de destino saiu do estado "aberto" (baixado, estornado etc. bloqueiam). */
export async function estornarRenegociacao(id: string): Promise<RenegociacaoFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;
  const empresaId = permissao.session.user.empresaId!;

  const renegociacao = await db.renegociacao.findFirst({
    where: { id, empresaId },
    include: { origens: true, destinos: { include: { lancamento: true } }, creditosUsados: true },
  });
  if (!renegociacao) return { erro: "Renegociação não encontrada." };
  if (renegociacao.status !== "fechada") return { erro: "Só é possível estornar uma renegociação fechada." };

  for (const destino of renegociacao.destinos) {
    if (!destino.lancamento || destino.lancamento.status !== "aberto") {
      return { erro: `O título "${destino.historicoSimplificado}" não está mais em aberto (já foi baixado ou alterado) — não é possível estornar esta renegociação.` };
    }
  }

  await db.$transaction(async (tx) => {
    for (const destino of renegociacao.destinos) {
      await tx.lancamentoFinanceiro.update({ where: { id: destino.lancamentoId! }, data: { status: "cancelado" } });
    }
    for (const origem of renegociacao.origens) {
      await tx.lancamentoFinanceiro.update({ where: { id: origem.lancamentoId }, data: { status: "aberto" } });
    }
    for (const usado of renegociacao.creditosUsados) {
      await tx.creditoDevolucao.update({
        where: { id: usado.creditoDevolucaoId },
        data: { saldoDisponivel: { increment: usado.valorUtilizado } },
      });
    }
    await tx.creditoDevolucaoUtilizado.deleteMany({ where: { renegociacaoId: id } });
    await tx.renegociacao.update({ where: { id }, data: { status: "estornada", estornadoEm: new Date() } });
  });

  revalidatePath("/renegociacoes");
  revalidatePath(`/renegociacoes/${id}`);
  revalidatePath("/lancamentos-financeiros");
  return {};
}
