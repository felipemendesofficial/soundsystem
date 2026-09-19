"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeLancarMovimentacao } from "@/lib/permissions";
import {
  estornarLinhaDeMovimentoNaTransacao,
  mensagemSaldoInsuficiente,
  registrarSaidaNaTransacao,
  resolverTenantPorDepositoValidado,
  SaldoInsuficienteError,
} from "@/lib/kardex";
import { normalizarTexto } from "@/lib/texto";
import { calcularAjusteTotal } from "@/lib/ajuste-total";

export type OrdemServicoFormState = { erro?: string };

const itemSchema = z.object({
  tipo: z.enum(["produto", "servico"]),
  itemId: z.string().min(1),
  quantidade: z.coerce.number().positive(),
  precoOriginal: z.coerce.number().nonnegative(),
});

const schema = z.object({
  clienteId: z.string().min(1, "Selecione o cliente."),
  depositoId: z.string().min(1, "Selecione o depósito."),
  vendedorId: z.string().min(1, "Selecione o vendedor."),
  observacao: z.string().trim().transform(normalizarTexto).optional(),
  modoAjuste: z.enum(["nenhum", "desconto", "acrescimo"]),
  formatoAjuste: z.enum(["percentual", "valor"]),
  valorAjuste: z.coerce.number().nonnegative(),
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

/**
 * Recalcula o preço líquido de cada item a partir do precoOriginal (nunca
 * tocado pelo desconto) + a configuração de ajuste — nunca confiamos num
 * preço final computado no client. Preserva a ordem produtos-depois-serviços
 * de `parsed.data.itens` em cada lista de saída, casando com
 * `resultadoAjuste.precosFinais` pelo mesmo índice usado no cálculo.
 */
function calcularItensComPrecoLiquido(dados: z.infer<typeof schema>) {
  const resultadoAjuste = calcularAjusteTotal(
    dados.itens.map((i) => ({ quantidade: i.quantidade, precoDeclarado: i.precoOriginal })),
    { modo: dados.modoAjuste, formato: dados.formatoAjuste, valor: dados.valorAjuste }
  );

  return dados.itens.map((item, idx) => ({
    ...item,
    precoUnitario: resultadoAjuste.precosFinais[idx],
  }));
}

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
    vendedorId: formData.get("vendedorId"),
    observacao: formData.get("observacao"),
    modoAjuste: formData.get("modoAjuste"),
    formatoAjuste: formData.get("formatoAjuste"),
    valorAjuste: formData.get("valorAjuste"),
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

  const tenant = await resolverTenantPorDepositoValidado(db, parsed.data.depositoId, permissao.session.user.empresaId!);
  if (!tenant) return { erro: "Depósito não encontrado." };
  const { empresaId, grupoId } = tenant;
  const itensComPrecoLiquido = calcularItensComPrecoLiquido(parsed.data);
  const os = await db.ordemServico.create({
    data: {
      clienteId: parsed.data.clienteId,
      depositoId: parsed.data.depositoId,
      empresaId,
      grupoId,
      vendedorId: parsed.data.vendedorId,
      usuarioId: permissao.session.user.id,
      observacao: parsed.data.observacao || null,
      modoAjuste: parsed.data.modoAjuste,
      formatoAjuste: parsed.data.formatoAjuste,
      valorAjuste: parsed.data.valorAjuste,
      itensProduto: {
        create: itensComPrecoLiquido
          .filter((i) => i.tipo === "produto")
          .map((i) => ({
            produtoId: i.itemId,
            quantidade: i.quantidade,
            precoOriginal: i.precoOriginal,
            precoUnitario: i.precoUnitario,
          })),
      },
      itensServico: {
        create: itensComPrecoLiquido
          .filter((i) => i.tipo === "servico")
          .map((i) => ({
            servicoId: i.itemId,
            quantidade: i.quantidade,
            precoOriginal: i.precoOriginal,
            precoUnitario: i.precoUnitario,
          })),
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

  const osAtual = await db.ordemServico.findFirst({ where: { id, empresaId: permissao.session.user.empresaId! } });
  if (!osAtual) return { erro: "Ordem de Serviço não encontrada." };
  if (osAtual.status === "concluida" || osAtual.status === "cancelada") {
    return { erro: "Essa Ordem de Serviço não pode mais ser editada." };
  }

  const parsed = toData(formData);
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const tenant = await resolverTenantPorDepositoValidado(db, parsed.data.depositoId, permissao.session.user.empresaId!);
  if (!tenant) return { erro: "Depósito não encontrado." };
  const { empresaId, grupoId } = tenant;
  const itensComPrecoLiquido = calcularItensComPrecoLiquido(parsed.data);
  await db.$transaction(async (tx) => {
    await tx.itemOrdemServicoProduto.deleteMany({ where: { ordemServicoId: id } });
    await tx.itemOrdemServicoServico.deleteMany({ where: { ordemServicoId: id } });
    await tx.ordemServico.update({
      where: { id },
      data: {
        clienteId: parsed.data.clienteId,
        depositoId: parsed.data.depositoId,
        empresaId,
        grupoId,
        vendedorId: parsed.data.vendedorId,
        observacao: parsed.data.observacao || null,
        modoAjuste: parsed.data.modoAjuste,
        formatoAjuste: parsed.data.formatoAjuste,
        valorAjuste: parsed.data.valorAjuste,
        itensProduto: {
          create: itensComPrecoLiquido
            .filter((i) => i.tipo === "produto")
            .map((i) => ({
              produtoId: i.itemId,
              quantidade: i.quantidade,
              precoOriginal: i.precoOriginal,
              precoUnitario: i.precoUnitario,
            })),
        },
        itensServico: {
          create: itensComPrecoLiquido
            .filter((i) => i.tipo === "servico")
            .map((i) => ({
              servicoId: i.itemId,
              quantidade: i.quantidade,
              precoOriginal: i.precoOriginal,
              precoUnitario: i.precoUnitario,
            })),
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

  const os = await db.ordemServico.findFirst({ where: { id, empresaId: permissao.session.user.empresaId! } });
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

  const os = await db.ordemServico.findFirst({ where: { id, empresaId: permissao.session.user.empresaId! } });
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
      const os = await tx.ordemServico.findFirst({
        where: { id, empresaId: session.user.empresaId! },
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
          vendedorId: os.vendedorId,
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
    if (error instanceof SaldoInsuficienteError) return { erro: await mensagemSaldoInsuficiente(error) };
    if (error instanceof Error) return { erro: error.message };
    throw error;
  }

  revalidatePath(`/ordens-servico/${id}`);
  revalidatePath("/ordens-servico");
  revalidatePath("/estoque");
  return {};
}

/**
 * Estorna a conclusão de uma OS: devolve ao estoque exatamente a quantidade e
 * o custo que a baixa (`os_saida`) de cada item tirou (ver
 * `estornarLinhaDeMovimentoNaTransacao` em src/lib/kardex.ts) e volta a OS
 * para "em_andamento", pronta pra ser editada e concluída de novo.
 */
export async function estornarConclusaoOrdemServico(
  id: string,
  _prev: OrdemServicoFormState,
  _formData: FormData
): Promise<OrdemServicoFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;
  const { session } = permissao;

  try {
    await db.$transaction(async (tx) => {
      const os = await tx.ordemServico.findFirst({ where: { id, empresaId: session.user.empresaId! } });
      if (!os) throw new Error("Ordem de Serviço não encontrada.");
      if (os.status !== "concluida") throw new Error("Essa Ordem de Serviço não está concluída.");

      const movimentos = await tx.movimentacao.findMany({
        where: { ordemServicoId: id, estornadoEm: null },
        orderBy: { produtoId: "asc" },
      });

      for (const movimento of movimentos) {
        await estornarLinhaDeMovimentoNaTransacao(
          tx,
          movimento,
          session.user.id,
          `Estorno da conclusão da OS #${os.numero}`
        );
      }

      await tx.ordemServico.update({ where: { id }, data: { status: "em_andamento" } });
    });
  } catch (error) {
    if (error instanceof SaldoInsuficienteError) return { erro: await mensagemSaldoInsuficiente(error) };
    if (error instanceof Error) return { erro: error.message };
    throw error;
  }

  revalidatePath(`/ordens-servico/${id}`);
  revalidatePath("/ordens-servico");
  revalidatePath("/estoque");
  return {};
}
