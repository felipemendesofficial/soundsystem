"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeLancarMovimentacao } from "@/lib/permissions";
import { registrarSaidaNaTransacao, SaldoInsuficienteError } from "@/lib/kardex";
import { normalizarTexto } from "@/lib/texto";

export type OrdemServicoFormState = { erro?: string };

const itemSchema = z.object({
  tipo: z.enum(["produto", "servico"]),
  itemId: z.string().min(1),
  quantidade: z.coerce.number().positive(),
  precoUnitario: z.coerce.number().nonnegative(),
});

const schema = z.object({
  clienteId: z.string().min(1, "Selecione o cliente."),
  depositoId: z.string().min(1, "Selecione o depósito."),
  observacao: z.string().trim().transform(normalizarTexto).optional(),
  itens: z
    .string()
    .transform((valor, ctx) => {
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(valor);
      } catch {
        ctx.addIssue({ code: "custom", message: "Itens inválidos." });
        return z.NEVER;
      }
      const resultado = z.array(itemSchema).min(1, "Adicione ao menos um item.").safeParse(parsedJson);
      if (!resultado.success) {
        ctx.addIssue({ code: "custom", message: "Adicione ao menos um item válido." });
        return z.NEVER;
      }
      return resultado.data;
    }),
});

async function exigirPermissao() {
  const session = await auth();
  if (!session?.user) return { erro: "Não autenticado." } as const;
  if (!podeLancarMovimentacao(session.user.perfil)) {
    return { erro: "Seu perfil não pode lançar Ordens de Serviço." } as const;
  }
  return { session } as const;
}

function toData(formData: FormData) {
  return schema.safeParse({
    clienteId: formData.get("clienteId"),
    depositoId: formData.get("depositoId"),
    observacao: formData.get("observacao"),
    itens: formData.get("itens"),
  });
}

export async function criarOrdemServico(
  _prev: OrdemServicoFormState,
  formData: FormData
): Promise<OrdemServicoFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;

  const parsed = toData(formData);
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const os = await db.ordemServico.create({
    data: {
      clienteId: parsed.data.clienteId,
      depositoId: parsed.data.depositoId,
      usuarioId: permissao.session.user.id,
      observacao: parsed.data.observacao || null,
      itensProduto: {
        create: parsed.data.itens
          .filter((i) => i.tipo === "produto")
          .map((i) => ({ produtoId: i.itemId, quantidade: i.quantidade, precoUnitario: i.precoUnitario })),
      },
      itensServico: {
        create: parsed.data.itens
          .filter((i) => i.tipo === "servico")
          .map((i) => ({ servicoId: i.itemId, quantidade: i.quantidade, precoUnitario: i.precoUnitario })),
      },
    },
  });

  revalidatePath("/ordens-servico");
  redirect(`/ordens-servico/${os.id}`);
}

export async function atualizarOrdemServico(
  id: string,
  _prev: OrdemServicoFormState,
  formData: FormData
): Promise<OrdemServicoFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;

  const osAtual = await db.ordemServico.findUnique({ where: { id } });
  if (!osAtual) return { erro: "Ordem de Serviço não encontrada." };
  if (osAtual.status === "concluida" || osAtual.status === "cancelada") {
    return { erro: "Essa Ordem de Serviço não pode mais ser editada." };
  }

  const parsed = toData(formData);
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  await db.$transaction(async (tx) => {
    await tx.itemOrdemServicoProduto.deleteMany({ where: { ordemServicoId: id } });
    await tx.itemOrdemServicoServico.deleteMany({ where: { ordemServicoId: id } });
    await tx.ordemServico.update({
      where: { id },
      data: {
        clienteId: parsed.data.clienteId,
        depositoId: parsed.data.depositoId,
        observacao: parsed.data.observacao || null,
        itensProduto: {
          create: parsed.data.itens
            .filter((i) => i.tipo === "produto")
            .map((i) => ({ produtoId: i.itemId, quantidade: i.quantidade, precoUnitario: i.precoUnitario })),
        },
        itensServico: {
          create: parsed.data.itens
            .filter((i) => i.tipo === "servico")
            .map((i) => ({ servicoId: i.itemId, quantidade: i.quantidade, precoUnitario: i.precoUnitario })),
        },
      },
    });
  });

  revalidatePath("/ordens-servico");
  redirect(`/ordens-servico/${id}`);
}

export async function iniciarOrdemServico(
  id: string,
  _prev: OrdemServicoFormState,
  _formData: FormData
): Promise<OrdemServicoFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;

  const os = await db.ordemServico.findUnique({ where: { id } });
  if (!os) return { erro: "Ordem de Serviço não encontrada." };
  if (os.status !== "aberta") return { erro: "Só é possível iniciar uma OS aberta." };

  await db.ordemServico.update({ where: { id }, data: { status: "em_andamento" } });

  revalidatePath(`/ordens-servico/${id}`);
  revalidatePath("/ordens-servico");
  return {};
}

export async function cancelarOrdemServico(
  id: string,
  _prev: OrdemServicoFormState,
  _formData: FormData
): Promise<OrdemServicoFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;

  const os = await db.ordemServico.findUnique({ where: { id } });
  if (!os) return { erro: "Ordem de Serviço não encontrada." };
  if (os.status === "concluida" || os.status === "cancelada") {
    return { erro: "Essa Ordem de Serviço não pode mais ser cancelada." };
  }

  await db.ordemServico.update({ where: { id }, data: { status: "cancelada" } });

  revalidatePath(`/ordens-servico/${id}`);
  revalidatePath("/ordens-servico");
  return {};
}

export async function concluirOrdemServico(
  id: string,
  _prev: OrdemServicoFormState,
  _formData: FormData
): Promise<OrdemServicoFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;
  const { session } = permissao;

  try {
    await db.$transaction(async (tx) => {
      const os = await tx.ordemServico.findUnique({
        where: { id },
        include: { itensProduto: true },
      });
      if (!os) throw new Error("Ordem de Serviço não encontrada.");
      if (os.status === "concluida" || os.status === "cancelada") {
        throw new Error("Essa Ordem de Serviço já foi concluída ou cancelada.");
      }

      const itensOrdenados = [...os.itensProduto].sort((a, b) => a.produtoId.localeCompare(b.produtoId));

      for (const item of itensOrdenados) {
        await registrarSaidaNaTransacao(tx, {
          produtoId: item.produtoId,
          depositoId: os.depositoId,
          tipoMovimento: "os_saida",
          quantidade: item.quantidade.toString(),
          precoVenda: item.precoUnitario.toString(),
          clienteId: os.clienteId,
          usuarioId: session.user.id,
          observacao: `Baixa referente à OS #${os.numero}`,
          ordemServicoId: os.id,
        });
      }

      await tx.ordemServico.update({
        where: { id },
        data: { status: "concluida", concluidaEm: new Date() },
      });
    });
  } catch (error) {
    if (error instanceof SaldoInsuficienteError) return { erro: error.message };
    if (error instanceof Error) return { erro: error.message };
    throw error;
  }

  revalidatePath(`/ordens-servico/${id}`);
  revalidatePath("/ordens-servico");
  revalidatePath("/estoque");
  return {};
}
