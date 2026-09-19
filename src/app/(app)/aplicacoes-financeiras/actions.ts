"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Prisma } from "@/generated/prisma/client";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { registrarMovimentoAplicacao, registrarEstornoMovimentoAplicacao } from "@/lib/financeiro-ledger";
import { normalizarTexto } from "@/lib/texto";

export type MovimentoAplicacaoFormState = { erro?: string };

const TIPOS = ["aplicacao_financeira", "resgate_aplicacao", "registro_rendimento"] as const;

const schema = z.object({
  tipoMovimento: z.enum(TIPOS, { message: "Selecione o tipo." }),
  daContaId: z.string().trim().nullish(),
  paraContaId: z.string().min(1, "Selecione a conta de aplicação."),
  valor: z.coerce.number().positive("Valor deve ser maior que zero."),
  data: z.coerce.date({ message: "Informe a data." }),
});

/** Aplicação/Resgate/Rendimento numa conta do tipo `aplicacao` — usa o Plano Financeiro de Parâmetros Financeiros. */
export async function criarMovimentoAplicacao(
  _prev: MovimentoAplicacaoFormState,
  formData: FormData
): Promise<MovimentoAplicacaoFormState> {
  const session = await auth();
  if (!session?.user) return { erro: "Não autenticado." };
  if (!podeGerenciarFinanceiro(session.user.perfil)) return { erro: "Seu perfil não pode gerenciar o Financeiro." };
  const empresaId = session.user.empresaId!;

  const parsed = schema.safeParse({
    tipoMovimento: formData.get("tipoMovimento"),
    daContaId: formData.get("daContaId"),
    paraContaId: formData.get("paraContaId"),
    valor: formData.get("valor"),
    data: formData.get("data"),
  });
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const dados = parsed.data;

  if (dados.tipoMovimento !== "registro_rendimento" && !dados.daContaId) {
    return { erro: "Selecione a conta de origem." };
  }

  try {
    await registrarMovimentoAplicacao({
      empresaId,
      tipoMovimento: dados.tipoMovimento,
      daContaId: dados.tipoMovimento === "registro_rendimento" ? undefined : dados.daContaId ?? undefined,
      paraContaId: dados.paraContaId,
      valor: new Prisma.Decimal(dados.valor),
      data: dados.data,
      usuarioId: session.user.id,
    });
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Não foi possível registrar o movimento." };
  }

  revalidatePath("/aplicacoes-financeiras");
  redirect("/aplicacoes-financeiras");
}

const estornoSchema = z.object({
  motivo: z.string().trim().min(1, "Informe o motivo.").transform(normalizarTexto),
});

/** Estorna um MovimentoAplicacao — cria o movimento inverso e devolve os saldos. */
export async function estornarMovimentoAplicacao(
  movimentoAplicacaoId: string,
  _prev: MovimentoAplicacaoFormState,
  formData: FormData
): Promise<MovimentoAplicacaoFormState> {
  const session = await auth();
  if (!session?.user) return { erro: "Não autenticado." };
  if (!podeGerenciarFinanceiro(session.user.perfil)) return { erro: "Seu perfil não pode gerenciar o Financeiro." };

  const parsed = estornoSchema.safeParse({ motivo: formData.get("motivo") });
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  try {
    await registrarEstornoMovimentoAplicacao({
      movimentoAplicacaoId,
      motivo: parsed.data.motivo,
      dataEstorno: new Date(),
      usuarioId: session.user.id,
    });
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Não foi possível estornar o movimento." };
  }

  revalidatePath("/aplicacoes-financeiras");
  return {};
}
