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
  dataInicioControle: z.coerce.date().optional(),
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
    dataInicioControle: formData.get("dataInicioControle") || undefined,
  });
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const dados = parsed.data;

  const atual = await db.parametroFinanceiro.findUnique({ where: { empresaId } });
  // A data de início é o "chão" da sequência de Fechamento Diário — uma vez
  // que já existe algum fechamento registrado, mudar essa data desalinharia
  // a sequência já fechada com a config nova. Trava depois do primeiro
  // fechamento, não antes (dá pra ajustar livremente enquanto não fechou nada).
  const existeFechamento = (await db.fechamentoDiario.count({ where: { empresaId } })) > 0;
  const dataAtualIso = atual?.dataInicioControle?.toISOString().slice(0, 10);
  const dataNovaIso = dados.dataInicioControle?.toISOString().slice(0, 10);
  if (existeFechamento && dataAtualIso !== dataNovaIso) {
    return { erro: "Não é possível alterar a data de início do controle financeiro depois que algum dia já foi fechado." };
  }

  await db.parametroFinanceiro.upsert({
    where: { empresaId },
    create: {
      empresaId,
      planoAplicacaoId: dados.planoAplicacaoId || null,
      planoResgateId: dados.planoResgateId || null,
      planoRendimentoId: dados.planoRendimentoId || null,
      percentualMultaPadrao: dados.percentualMultaPadrao !== undefined ? new Prisma.Decimal(dados.percentualMultaPadrao) : null,
      dataInicioControle: dados.dataInicioControle ?? null,
    },
    update: {
      planoAplicacaoId: dados.planoAplicacaoId || null,
      planoResgateId: dados.planoResgateId || null,
      planoRendimentoId: dados.planoRendimentoId || null,
      percentualMultaPadrao: dados.percentualMultaPadrao !== undefined ? new Prisma.Decimal(dados.percentualMultaPadrao) : null,
      dataInicioControle: dados.dataInicioControle ?? null,
    },
  });

  revalidatePath("/parametros-financeiros");
  return { sucesso: true };
}
