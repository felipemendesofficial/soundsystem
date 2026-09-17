"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { normalizarTexto } from "@/lib/texto";
import { montarCodigo, naturezaParaNivel, segmentoDoNivel, SegmentoInvalidoError } from "@/lib/mascara";

export type CentroCustoFormState = { erro?: string };

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
});

export async function criarCentroCusto(
  paiId: string | null,
  mascaraId: string,
  _prev: CentroCustoFormState,
  formData: FormData
): Promise<CentroCustoFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;
  const grupoId = permissao.session.user.grupoId!;

  const parsed = criarSchema.safeParse({
    segmento: formData.get("segmento"),
    descricao: formData.get("descricao"),
  });
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const mascara = await db.mascaraCentroCusto.findFirst({
    where: { id: mascaraId, grupoId },
    include: { segmentos: { orderBy: { ordem: "asc" } } },
  });
  if (!mascara) return { erro: "Máscara não encontrada." };

  const pai = paiId ? await db.centroCusto.findFirst({ where: { id: paiId, grupoId, mascaraId } }) : null;
  if (paiId && !pai) return { erro: "Centro de custo pai não encontrado." };
  if (pai && pai.natureza !== "sintetica") return { erro: "Só é possível adicionar filho em um centro sintético." };

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
    await db.centroCusto.create({
      data: {
        grupoId,
        mascaraId,
        paiId,
        codigo,
        descricao: parsed.data.descricao,
        natureza: naturezaParaNivel(nivel, mascara.segmentos.length),
        nivel,
      },
    });
  } catch {
    return { erro: `Já existe um centro de custo com o código "${codigo}" neste grupo.` };
  }

  revalidatePath("/centros-custo");
  redirect(`/centros-custo?mascaraId=${mascaraId}`);
}

const atualizarSchema = z.object({
  descricao: z.string().trim().min(1, "Informe a descrição.").transform(normalizarTexto),
});

export async function atualizarCentroCusto(
  id: string,
  _prev: CentroCustoFormState,
  formData: FormData
): Promise<CentroCustoFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;

  const parsed = atualizarSchema.safeParse({ descricao: formData.get("descricao") });
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const centro = await db.centroCusto.findFirst({
    where: { id, grupoId: permissao.session.user.grupoId! },
  });
  if (!centro) return { erro: "Centro de custo não encontrado." };

  await db.centroCusto.update({ where: { id }, data: parsed.data });

  revalidatePath("/centros-custo");
  redirect(`/centros-custo?mascaraId=${centro.mascaraId}`);
}

export async function alternarAtivoCentroCusto(id: string, ativo: boolean) {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return;

  await db.centroCusto.updateMany({
    where: { id, grupoId: permissao.session.user.grupoId! },
    data: { ativo },
  });
  revalidatePath("/centros-custo");
}
