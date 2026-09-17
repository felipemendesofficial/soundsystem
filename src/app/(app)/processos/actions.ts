"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { normalizarTexto } from "@/lib/texto";
import { montarCodigo, naturezaParaNivel, segmentoDoNivel, SegmentoInvalidoError } from "@/lib/mascara";

export type ProcessoFormState = { erro?: string };
export type ProcessoItemFormState = { erro?: string };

async function exigirPermissao() {
  const session = await auth();
  if (!session?.user) return { erro: "Não autenticado." } as const;
  if (!podeGerenciarFinanceiro(session.user.perfil)) {
    return { erro: "Seu perfil não pode gerenciar o Financeiro." } as const;
  }
  return { session } as const;
}

// --- Processo (instância datada) -------------------------------------------

const processoSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome.").transform(normalizarTexto),
  mascaraId: z.string().min(1, "Selecione a máscara."),
  dataInicio: z.coerce.date({ message: "Informe a data de início." }),
  dataFim: z.coerce.date({ message: "Informe a data de fim." }),
  padrao: z.enum(["on"]).nullish(),
});

export async function criarProcesso(_prev: ProcessoFormState, formData: FormData): Promise<ProcessoFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;
  const { grupoId, empresaId } = permissao.session.user;

  const parsed = processoSchema.safeParse({
    nome: formData.get("nome"),
    mascaraId: formData.get("mascaraId"),
    dataInicio: formData.get("dataInicio"),
    dataFim: formData.get("dataFim"),
    padrao: formData.get("padrao"),
  });
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  if (parsed.data.dataFim < parsed.data.dataInicio) return { erro: "A data de fim não pode ser anterior à de início." };

  const mascara = await db.mascaraProcesso.findFirst({ where: { id: parsed.data.mascaraId, grupoId: grupoId! } });
  if (!mascara) return { erro: "Máscara não encontrada." };

  const ehPadrao = parsed.data.padrao === "on";

  try {
    await db.$transaction(async (tx) => {
      if (ehPadrao) {
        await tx.processo.updateMany({ where: { empresaId: empresaId!, padrao: true }, data: { padrao: false } });
      }
      await tx.processo.create({
        data: {
          empresaId: empresaId!,
          mascaraId: parsed.data.mascaraId,
          nome: parsed.data.nome,
          dataInicio: parsed.data.dataInicio,
          dataFim: parsed.data.dataFim,
          padrao: ehPadrao,
        },
      });
    });
  } catch {
    return { erro: "Não foi possível salvar o processo." };
  }

  revalidatePath("/processos");
  redirect("/processos");
}

export async function atualizarProcesso(
  id: string,
  _prev: ProcessoFormState,
  formData: FormData
): Promise<ProcessoFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;
  const empresaId = permissao.session.user.empresaId!;

  const parsed = processoSchema
    .omit({ mascaraId: true })
    .safeParse({
      nome: formData.get("nome"),
      dataInicio: formData.get("dataInicio"),
      dataFim: formData.get("dataFim"),
      padrao: formData.get("padrao"),
    });
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  if (parsed.data.dataFim < parsed.data.dataInicio) return { erro: "A data de fim não pode ser anterior à de início." };

  const processo = await db.processo.findFirst({ where: { id, empresaId } });
  if (!processo) return { erro: "Processo não encontrado." };

  const ehPadrao = parsed.data.padrao === "on";

  try {
    await db.$transaction(async (tx) => {
      if (ehPadrao) {
        await tx.processo.updateMany({
          where: { empresaId, padrao: true, id: { not: id } },
          data: { padrao: false },
        });
      }
      await tx.processo.update({
        where: { id },
        data: {
          nome: parsed.data.nome,
          dataInicio: parsed.data.dataInicio,
          dataFim: parsed.data.dataFim,
          padrao: ehPadrao,
        },
      });
    });
  } catch {
    return { erro: "Não foi possível salvar o processo." };
  }

  revalidatePath("/processos");
  redirect(`/processos/${id}`);
}

export async function alternarAtivoProcesso(id: string, ativo: boolean) {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return;

  await db.processo.updateMany({
    where: { id, empresaId: permissao.session.user.empresaId! },
    data: { ativo },
  });
  revalidatePath("/processos");
  revalidatePath(`/processos/${id}`);
}

// --- ProcessoItem (árvore dentro de uma instância de Processo) -------------

const criarItemSchema = z.object({
  segmento: z.string().trim().min(1, "Informe o código deste nível."),
  descricao: z.string().trim().min(1, "Informe a descrição.").transform(normalizarTexto),
});

export async function criarProcessoItem(
  processoId: string,
  paiId: string | null,
  _prev: ProcessoItemFormState,
  formData: FormData
): Promise<ProcessoItemFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;
  const empresaId = permissao.session.user.empresaId!;

  const parsed = criarItemSchema.safeParse({
    segmento: formData.get("segmento"),
    descricao: formData.get("descricao"),
  });
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const processo = await db.processo.findFirst({
    where: { id: processoId, empresaId },
    include: { mascara: { include: { segmentos: { orderBy: { ordem: "asc" } } } } },
  });
  if (!processo) return { erro: "Processo não encontrado." };

  const pai = paiId ? await db.processoItem.findFirst({ where: { id: paiId, processoId } }) : null;
  if (paiId && !pai) return { erro: "Item pai não encontrado." };
  if (pai && pai.natureza !== "sintetica") return { erro: "Só é possível adicionar filho em um item sintético." };

  const nivel = (pai?.nivel ?? 0) + 1;
  const segmentoMascara = segmentoDoNivel(processo.mascara.segmentos, nivel);
  if (!segmentoMascara) return { erro: "Esta máscara não tem mais níveis disponíveis." };

  let codigo: string;
  try {
    codigo = montarCodigo(pai?.codigo ?? null, parsed.data.segmento, segmentoMascara.qtdDigitos);
  } catch (e) {
    return { erro: e instanceof SegmentoInvalidoError ? e.message : "Código inválido." };
  }

  try {
    await db.processoItem.create({
      data: {
        processoId,
        paiId,
        codigo,
        descricao: parsed.data.descricao,
        natureza: naturezaParaNivel(nivel, processo.mascara.segmentos.length),
        nivel,
      },
    });
  } catch {
    return { erro: `Já existe um item com o código "${codigo}" neste processo.` };
  }

  revalidatePath(`/processos/${processoId}`);
  redirect(`/processos/${processoId}`);
}

const atualizarItemSchema = z.object({
  descricao: z.string().trim().min(1, "Informe a descrição.").transform(normalizarTexto),
});

export async function atualizarProcessoItem(
  processoId: string,
  itemId: string,
  _prev: ProcessoItemFormState,
  formData: FormData
): Promise<ProcessoItemFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;
  const empresaId = permissao.session.user.empresaId!;

  const parsed = atualizarItemSchema.safeParse({ descricao: formData.get("descricao") });
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const processo = await db.processo.findFirst({ where: { id: processoId, empresaId } });
  if (!processo) return { erro: "Processo não encontrado." };

  const { count } = await db.processoItem.updateMany({
    where: { id: itemId, processoId },
    data: parsed.data,
  });
  if (count === 0) return { erro: "Item não encontrado." };

  revalidatePath(`/processos/${processoId}`);
  redirect(`/processos/${processoId}`);
}

export async function alternarAtivoProcessoItem(processoId: string, itemId: string, ativo: boolean) {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return;

  const processo = await db.processo.findFirst({
    where: { id: processoId, empresaId: permissao.session.user.empresaId! },
  });
  if (!processo) return;

  await db.processoItem.updateMany({ where: { id: itemId, processoId }, data: { ativo } });
  revalidatePath(`/processos/${processoId}`);
}
