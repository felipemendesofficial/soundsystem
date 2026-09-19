"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { normalizarTexto } from "@/lib/texto";
import { montarCodigo, naturezaParaNivel, segmentoDoNivel, SegmentoInvalidoError } from "@/lib/mascara";

export type PlanoFinanceiroFormState = { erro?: string };

async function exigirPermissao() {
  const session = await auth();
  if (!session?.user) return { erro: "Não autenticado." } as const;
  if (!podeGerenciarFinanceiro(session.user.perfil)) {
    return { erro: "Seu perfil não pode gerenciar o Financeiro." } as const;
  }
  return { session } as const;
}

const criarSchema = z.object({
  segmento: z.string().trim().min(1, "Informe o código deste nível."),
  descricao: z.string().trim().min(1, "Informe a descrição.").transform(normalizarTexto),
  tipo: z.enum(["receita", "despesa"], { message: "Selecione o tipo." }),
  permiteRetencao: z.enum(["on"]).nullish(),
});

/**
 * `paiId`/`mascaraId` vêm do link "adicionar filho"/"nova raiz" da árvore
 * (`.bind`, mesmo padrão de `adicionarEmpresa` em admin/grupos/actions.ts) —
 * nunca de um campo de formulário, pra não confiar no client pra decidir
 * nível/código/natureza.
 */
export async function criarPlanoFinanceiro(
  paiId: string | null,
  mascaraId: string,
  _prev: PlanoFinanceiroFormState,
  formData: FormData
): Promise<PlanoFinanceiroFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;
  const grupoId = permissao.session.user.grupoId!;

  const parsed = criarSchema.safeParse({
    segmento: formData.get("segmento"),
    descricao: formData.get("descricao"),
    tipo: formData.get("tipo"),
    permiteRetencao: formData.get("permiteRetencao"),
  });
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const mascara = await db.mascaraPlanoFinanceiro.findFirst({
    where: { id: mascaraId, grupoId },
    include: { segmentos: { orderBy: { ordem: "asc" } } },
  });
  if (!mascara) return { erro: "Máscara não encontrada." };

  const pai = paiId ? await db.planoFinanceiro.findFirst({ where: { id: paiId, grupoId, mascaraId } }) : null;
  if (paiId && !pai) return { erro: "Conta pai não encontrada." };
  if (pai && pai.natureza !== "sintetica") return { erro: "Só é possível adicionar filho em uma conta sintética." };

  const nivel = (pai?.nivel ?? 0) + 1;
  const segmentoMascara = segmentoDoNivel(mascara.segmentos, nivel);
  if (!segmentoMascara) return { erro: "Esta máscara não tem mais níveis disponíveis." };

  let codigo: string;
  try {
    codigo = montarCodigo(pai?.codigo ?? null, parsed.data.segmento, segmentoMascara.qtdDigitos);
  } catch (e) {
    return { erro: e instanceof SegmentoInvalidoError ? e.message : "Código inválido." };
  }

  try {
    await db.planoFinanceiro.create({
      data: {
        grupoId,
        mascaraId,
        paiId,
        codigo,
        descricao: parsed.data.descricao,
        tipo: parsed.data.tipo,
        natureza: naturezaParaNivel(nivel, mascara.segmentos.length),
        nivel,
        permiteRetencao: parsed.data.permiteRetencao === "on",
      },
    });
  } catch {
    return { erro: `Já existe uma conta com o código "${codigo}" neste grupo.` };
  }

  revalidatePath("/planos-financeiros");
  redirect(`/planos-financeiros?mascaraId=${mascaraId}`);
}

const atualizarSchema = z.object({
  descricao: z.string().trim().min(1, "Informe a descrição.").transform(normalizarTexto),
  tipo: z.enum(["receita", "despesa"], { message: "Selecione o tipo." }),
  permiteRetencao: z.enum(["on"]).nullish(),
});

export async function atualizarPlanoFinanceiro(
  id: string,
  _prev: PlanoFinanceiroFormState,
  formData: FormData
): Promise<PlanoFinanceiroFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;

  const parsed = atualizarSchema.safeParse({
    descricao: formData.get("descricao"),
    tipo: formData.get("tipo"),
    permiteRetencao: formData.get("permiteRetencao"),
  });
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const plano = await db.planoFinanceiro.findFirst({
    where: { id, grupoId: permissao.session.user.grupoId! },
  });
  if (!plano) return { erro: "Conta não encontrada." };

  await db.planoFinanceiro.update({
    where: { id },
    data: {
      descricao: parsed.data.descricao,
      tipo: parsed.data.tipo,
      permiteRetencao: parsed.data.permiteRetencao === "on",
    },
  });

  revalidatePath("/planos-financeiros");
  redirect(`/planos-financeiros?mascaraId=${plano.mascaraId}`);
}

export async function alternarAtivoPlanoFinanceiro(id: string, ativo: boolean) {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return;

  await db.planoFinanceiro.updateMany({
    where: { id, grupoId: permissao.session.user.grupoId! },
    data: { ativo },
  });
  revalidatePath("/planos-financeiros");
}
