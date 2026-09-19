"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";

export type VincularChequeFormState = { erro?: string };

const schema = z.object({
  baixaChequeId: z.string().min(1, "Selecione o cheque."),
});

/**
 * Registra que a Baixa desta Despesa foi paga repassando um cheque de
 * terceiro recebido numa Receita (em vez de sair da conta escolhida na
 * Baixa) — só rastreio/auditoria por ora: não desfaz o movimento já lançado
 * na conta da Baixa da despesa (ajuste manual, se necessário, é uma
 * Transferência/estorno à parte).
 */
export async function vincularChequeTerceiro(
  lancamentoId: string,
  _prev: VincularChequeFormState,
  formData: FormData
): Promise<VincularChequeFormState> {
  const session = await auth();
  if (!session?.user) return { erro: "Não autenticado." };
  if (!podeGerenciarFinanceiro(session.user.perfil)) return { erro: "Seu perfil não pode gerenciar o Financeiro." };
  const empresaId = session.user.empresaId!;

  const lancamento = await db.lancamentoFinanceiro.findFirst({ where: { id: lancamentoId, empresaId } });
  if (!lancamento) return { erro: "Lançamento não encontrado." };
  if (lancamento.tipo !== "despesa") return { erro: "Só é possível vincular cheque de terceiro numa despesa." };

  const baixaDespesa = await db.baixa.findFirst({ where: { lancamentoId, estornada: false } });
  if (!baixaDespesa) return { erro: "Não há baixa ativa nesta despesa." };

  const parsed = schema.safeParse({ baixaChequeId: formData.get("baixaChequeId") });
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const baixaCheque = await db.baixa.findFirst({
    where: {
      id: parsed.data.baixaChequeId,
      estornada: false,
      lancamento: { empresaId, tipo: "receita", tipoDocumento: { in: ["cheque_vista", "cheque_prazo"] } },
      utilizadoComoChequeEm: null,
    },
  });
  if (!baixaCheque) return { erro: "Cheque não encontrado ou já utilizado." };

  try {
    await db.chequeTerceiroUtilizado.create({
      data: { baixaDespesaId: baixaDespesa.id, baixaChequeId: baixaCheque.id },
    });
  } catch {
    return { erro: "Não foi possível vincular o cheque." };
  }

  revalidatePath(`/lancamentos-financeiros/${lancamentoId}`);
  redirect(`/lancamentos-financeiros/${lancamentoId}`);
}
