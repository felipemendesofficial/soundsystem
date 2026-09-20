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

export type RecolhimentoFormState = { erro?: string };

async function exigirPermissao() {
  const session = await auth();
  if (!session?.user) return { erro: "Não autenticado." } as const;
  if (!podeGerenciarFinanceiro(session.user.perfil)) {
    return { erro: "Seu perfil não pode gerenciar o Financeiro." } as const;
  }
  return { session } as const;
}

const TIPOS_DOCUMENTO = [
  "especie",
  "cheque_vista",
  "cheque_prazo",
  "deposito_cartorio",
  "nota_promissoria",
  "deposito_bancario",
  "pix",
] as const;

const criarSchema = z.object({
  processoId: z.string().min(1, "Selecione o processo."),
  processoItemId: z.string().min(1, "Selecione o item do processo."),
  tipoDocumento: z.enum(TIPOS_DOCUMENTO, { message: "Selecione o tipo de documento." }),
  dataEmissao: z.coerce.date({ message: "Informe a data de emissão." }),
  dataVencimento: z.coerce.date({ message: "Informe a data de vencimento." }),
  observacao: z.string().trim().transform(normalizarTexto).optional(),
});

/**
 * Agrupa todas as Retenções `pendente` do mesmo Plano Financeiro (só de
 * lançamentos já `baixado` — reter só existe de fato depois que o dinheiro
 * subjacente já transitou) num único Lançamento de despesa "aberto", sem
 * fornecedor (é um recolhimento ao governo, não uma compra) — passa pela
 * Baixa normal depois, como qualquer despesa.
 */
export async function gerarRecolhimentoRetencao(
  planoId: string,
  _prev: RecolhimentoFormState,
  formData: FormData
): Promise<RecolhimentoFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;
  const empresaId = permissao.session.user.empresaId!;
  const grupoId = permissao.session.user.grupoId!;

  const plano = await db.planoFinanceiro.findFirst({ where: { id: planoId, grupoId, natureza: "analitica" } });
  if (!plano) return { erro: "Plano financeiro não encontrado." };

  const parsed = criarSchema.safeParse({
    processoId: formData.get("processoId"),
    processoItemId: formData.get("processoItemId"),
    tipoDocumento: formData.get("tipoDocumento"),
    dataEmissao: formData.get("dataEmissao"),
    dataVencimento: formData.get("dataVencimento"),
    observacao: formData.get("observacao"),
  });
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const dados = parsed.data;

  const processo = await db.processo.findFirst({ where: { id: dados.processoId, empresaId } });
  if (!processo) return { erro: "Processo não encontrado." };
  const processoItem = await db.processoItem.findFirst({
    where: { id: dados.processoItemId, processoId: dados.processoId, natureza: "analitica", ativo: true },
  });
  if (!processoItem) return { erro: "Item do processo não encontrado." };

  const retencoes = await db.retencao.findMany({
    where: { planoId, status: "pendente", lancamento: { empresaId, status: "baixado" } },
  });
  if (retencoes.length === 0) return { erro: "Não há retenções pendentes desse plano pra recolher." };

  const valorTotal = retencoes.reduce((acc, r) => acc.plus(r.valor), new Prisma.Decimal(0));

  const ultimoFechamento = await obterUltimoFechamentoAtivo(db, empresaId);
  const dataMovimento = ultimoFechamento?.data ?? new Date();

  let lancamentoId: string;
  try {
    lancamentoId = await db.$transaction(async (tx) => {
      const lancamento = await tx.lancamentoFinanceiro.create({
        data: {
          empresaId,
          tipo: "despesa",
          natureza: "real",
          historicoSimplificado: `Recolhimento — ${plano.codigo} ${plano.descricao}`,
          tipoDocumento: dados.tipoDocumento,
          valorOriginal: valorTotal,
          dataEmissao: dados.dataEmissao,
          dataVencimento: dados.dataVencimento,
          // Recolhimento não tem tela própria pra prever divergência de
          // pagamento — mesma suposição do backfill: igual ao vencimento.
          dataPrevisao: dados.dataVencimento,
          dataMovimento,
          processoId: dados.processoId,
          observacao: dados.observacao || null,
          criadoPorId: permissao.session.user.id,
          rateios: { create: [{ planoId, percentual: new Prisma.Decimal(100), valor: valorTotal }] },
          rateiosProcesso: {
            create: [{ processoItemId: dados.processoItemId, percentual: new Prisma.Decimal(100), valor: valorTotal }],
          },
        },
      });

      await tx.retencao.updateMany({
        where: { id: { in: retencoes.map((r) => r.id) } },
        data: { status: "recolhida", recolhimentoId: lancamento.id },
      });

      return lancamento.id;
    });
  } catch {
    return { erro: "Não foi possível gerar o recolhimento." };
  }

  revalidatePath("/recolhimentos-retencao");
  revalidatePath("/lancamentos-financeiros");
  redirect(`/lancamentos-financeiros/${lancamentoId}`);
}
