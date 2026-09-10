"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  estornarMovimentoNaTransacao,
  mensagemSaldoInsuficiente,
  MovimentoJaEstornadoError,
  SaldoInsuficienteError,
} from "@/lib/kardex";
import { podeLancarMovimentacao } from "@/lib/permissions";

export type MovimentacaoFormState = { erro?: string };

/**
 * Estorna um movimento avulso legado (de antes do Lançamento existir como
 * entidade — ver src/app/(app)/lancamentos) para corrigir erro de
 * lançamento: gera o inverso exato do movimento e marca o original como
 * estornado (ver `estornarMovimentoNaTransacao` em src/lib/kardex.ts).
 */
export async function estornarMovimento(
  id: string,
  _prev: MovimentacaoFormState,
  _formData: FormData
): Promise<MovimentacaoFormState> {
  const session = await auth();
  if (!session?.user) return { erro: "Não autenticado." };
  const { perfil, id: usuarioId } = session.user;

  if (!podeLancarMovimentacao(perfil)) {
    return { erro: "Seu perfil não pode estornar movimentações." };
  }

  const movimento = await db.movimentacao.findUnique({ where: { id } });
  if (!movimento) return { erro: "Movimento não encontrado." };
  if (perfil === "vendedor" && movimento.tipoMovimento !== "venda") {
    return { erro: "Seu perfil só pode estornar vendas." };
  }

  try {
    await db.$transaction((tx) =>
      estornarMovimentoNaTransacao(tx, {
        movimentoId: id,
        usuarioId,
        observacao: `Estorno do lançamento de ${new Date(movimento.dataMovimento).toLocaleDateString("pt-BR")}`,
      })
    );
  } catch (error) {
    if (error instanceof SaldoInsuficienteError) return { erro: await mensagemSaldoInsuficiente(error) };
    if (error instanceof MovimentoJaEstornadoError) return { erro: error.message };
    if (error instanceof Error) return { erro: error.message };
    throw error;
  }

  revalidatePath(`/kardex/${movimento.produtoId}`);
  revalidatePath("/estoque");
  return {};
}
