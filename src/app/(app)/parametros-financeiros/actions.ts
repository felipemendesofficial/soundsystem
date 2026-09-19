"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { podeGerenciarFinanceiro } from "@/lib/permissions";

export type ParametroFinanceiroFormState = { erro?: string; sucesso?: boolean };

const schema = z.object({
  planoAplicacaoId: z.string().trim().optional(),
  planoResgateId: z.string().trim().optional(),
  planoRendimentoId: z.string().trim().optional(),
  percentualMultaPadrao: z.coerce.number().nonnegative("Percentual não pode ser negativo.").optional(),
});

/** Config única por empresa (upsert) — planos usados pra Aplicação/Resgate/Rendimento e o % de multa sugerido na Baixa. */
export async function salvarParametroFinanceiro(
  _prev: ParametroFinanceiroFormState,
  formData: FormData
): Promise<ParametroFinanceiroFormState> {
  const session = await auth();
  if (!session?.user) return { erro: "Não autenticado." };
  if (!podeGerenciarFinanceiro(session.user.perfil)) return { erro: "Seu perfil não pode gerenciar o Financeiro." };
  const empresaId = session.user.empresaId!;

  const parsed = schema.safeParse({
    planoAplicacaoId: formData.get("planoAplicacaoId"),
    planoResgateId: formData.get("planoResgateId"),
    planoRendimentoId: formData.get("planoRendimentoId"),
    percentualMultaPadrao: formData.get("percentualMultaPadrao") || undefined,
  });
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const dados = parsed.data;

  await db.parametroFinanceiro.upsert({
    where: { empresaId },
    create: {
      empresaId,
      planoAplicacaoId: dados.planoAplicacaoId || null,
      planoResgateId: dados.planoResgateId || null,
      planoRendimentoId: dados.planoRendimentoId || null,
      percentualMultaPadrao: dados.percentualMultaPadrao !== undefined ? new Prisma.Decimal(dados.percentualMultaPadrao) : null,
    },
    update: {
      planoAplicacaoId: dados.planoAplicacaoId || null,
      planoResgateId: dados.planoResgateId || null,
      planoRendimentoId: dados.planoRendimentoId || null,
      percentualMultaPadrao: dados.percentualMultaPadrao !== undefined ? new Prisma.Decimal(dados.percentualMultaPadrao) : null,
    },
  });

  revalidatePath("/parametros-financeiros");
  return { sucesso: true };
}
