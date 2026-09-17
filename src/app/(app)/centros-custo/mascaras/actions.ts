"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { normalizarTexto } from "@/lib/texto";
import { parseSegmentosJson } from "@/lib/mascara";

export type MascaraCentroCustoFormState = { erro?: string };

async function exigirPermissao() {
  const session = await auth();
  if (!session?.user) return { erro: "Não autenticado." } as const;
  if (!podeGerenciarFinanceiro(session.user.perfil)) {
    return { erro: "Seu perfil não pode gerenciar o Financeiro." } as const;
  }
  return { session } as const;
}

const nomeSchema = z.string().trim().min(1, "Informe o nome.").transform(normalizarTexto);

export async function criarMascaraCentroCusto(
  _prev: MascaraCentroCustoFormState,
  formData: FormData
): Promise<MascaraCentroCustoFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;

  const nome = nomeSchema.safeParse(formData.get("nome"));
  if (!nome.success) return { erro: nome.error.issues[0]?.message ?? "Dados inválidos." };

  const segmentosParseados = parseSegmentosJson(formData.get("segmentosJson"));
  if ("erro" in segmentosParseados) return segmentosParseados;

  try {
    await db.mascaraCentroCusto.create({
      data: {
        grupoId: permissao.session.user.grupoId!,
        nome: nome.data,
        segmentos: { create: segmentosParseados.segmentos },
      },
    });
  } catch {
    return { erro: "Já existe uma máscara com esse nome." };
  }

  revalidatePath("/centros-custo/mascaras");
  redirect("/centros-custo/mascaras");
}

export async function atualizarMascaraCentroCusto(
  id: string,
  _prev: MascaraCentroCustoFormState,
  formData: FormData
): Promise<MascaraCentroCustoFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;

  const nome = nomeSchema.safeParse(formData.get("nome"));
  if (!nome.success) return { erro: nome.error.issues[0]?.message ?? "Dados inválidos." };

  const mascara = await db.mascaraCentroCusto.findFirst({
    where: { id, grupoId: permissao.session.user.grupoId! },
    include: { _count: { select: { centros: true } } },
  });
  if (!mascara) return { erro: "Máscara não encontrada." };

  const podeAlterarSegmentos = mascara._count.centros === 0;

  try {
    await db.$transaction(async (tx) => {
      await tx.mascaraCentroCusto.update({ where: { id }, data: { nome: nome.data } });

      if (podeAlterarSegmentos) {
        const segmentosParseados = parseSegmentosJson(formData.get("segmentosJson"));
        if ("erro" in segmentosParseados) throw new Error(segmentosParseados.erro);

        await tx.mascaraCentroCustoSegmento.deleteMany({ where: { mascaraId: id } });
        await tx.mascaraCentroCustoSegmento.createMany({
          data: segmentosParseados.segmentos.map((s) => ({ ...s, mascaraId: id })),
        });
      }
    });
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Já existe uma máscara com esse nome." };
  }

  revalidatePath("/centros-custo/mascaras");
  redirect("/centros-custo/mascaras");
}

export async function alternarAtivoMascaraCentroCusto(id: string, ativo: boolean) {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return;

  await db.mascaraCentroCusto.updateMany({
    where: { id, grupoId: permissao.session.user.grupoId! },
    data: { ativo },
  });
  revalidatePath("/centros-custo/mascaras");
}
