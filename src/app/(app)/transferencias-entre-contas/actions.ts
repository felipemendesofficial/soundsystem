"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { normalizarTexto } from "@/lib/texto";
import { registrarTransferencia, registrarEstornoTransferencia } from "@/lib/financeiro-ledger";
import { REGRAS_TRANSFERENCIA } from "@/lib/regras-conta-transferencia";

export type TransferenciaFormState = { erro?: string };

async function exigirPermissao() {
  const session = await auth();
  if (!session?.user) return { erro: "Não autenticado." } as const;
  if (!podeGerenciarFinanceiro(session.user.perfil)) {
    return { erro: "Seu perfil não pode gerenciar o Financeiro." } as const;
  }
  return { session } as const;
}

const TIPOS_MOVIMENTO = [
  "transferencia_geral",
  "reposicao_fundo_fixo",
  "saldo_caixa_banco",
  "emprestimo_contraido_banco",
  "transferencia_entre_caixas",
  "transferencia_banco_para_caixa",
] as const;

const criarSchema = z.object({
  contaOrigemId: z.string().trim().optional(),
  contaDestinoId: z.string().min(1, "Selecione a conta de destino."),
  tipoMovimento: z.enum(TIPOS_MOVIMENTO, { message: "Selecione o tipo." }),
  valor: z.coerce.number().positive("Valor deve ser maior que zero."),
  data: z.coerce.date({ message: "Informe a data." }),
  historico: z.string().trim().transform(normalizarTexto).optional(),
  origemTerceiroId: z.string().trim().optional(),
  destinoTerceiroId: z.string().trim().optional(),
});

/** Move dinheiro entre duas contas da empresa — só assim dá pra creditar/debitar o saldo de um Adiantamento por terceiro. */
export async function criarTransferencia(
  _prev: TransferenciaFormState,
  formData: FormData
): Promise<TransferenciaFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;
  const empresaId = permissao.session.user.empresaId!;
  const grupoId = permissao.session.user.grupoId!;

  const parsed = criarSchema.safeParse({
    contaOrigemId: formData.get("contaOrigemId"),
    contaDestinoId: formData.get("contaDestinoId"),
    tipoMovimento: formData.get("tipoMovimento"),
    valor: formData.get("valor"),
    data: formData.get("data"),
    historico: formData.get("historico"),
    origemTerceiroId: formData.get("origemTerceiroId"),
    destinoTerceiroId: formData.get("destinoTerceiroId"),
  });
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const dados = parsed.data;

  const regra = REGRAS_TRANSFERENCIA[dados.tipoMovimento];
  if (regra.semOrigem && dados.contaOrigemId) return { erro: "Esse tipo de transferência não tem conta de origem." };
  if (!regra.semOrigem && !dados.contaOrigemId) return { erro: "Selecione a conta de origem." };
  if (dados.contaOrigemId && dados.contaOrigemId === dados.contaDestinoId) {
    return { erro: "A conta de origem e a de destino não podem ser a mesma." };
  }

  const contaDestino = await db.contaFinanceira.findFirst({ where: { id: dados.contaDestinoId, empresaId } });
  if (!contaDestino) return { erro: "Conta de destino não encontrada." };
  const contaOrigem = dados.contaOrigemId
    ? await db.contaFinanceira.findFirst({ where: { id: dados.contaOrigemId, empresaId } })
    : null;
  if (dados.contaOrigemId && !contaOrigem) return { erro: "Conta de origem não encontrada." };

  const exigeOrigemCliente = contaOrigem?.adiantamentoCliente ?? false;
  const exigeOrigemFornecedor = contaOrigem?.adiantamentoFornecedor ?? false;
  const exigeDestinoCliente = contaDestino.adiantamentoCliente;
  const exigeDestinoFornecedor = contaDestino.adiantamentoFornecedor;

  if ((exigeOrigemCliente || exigeOrigemFornecedor) && !dados.origemTerceiroId) {
    return { erro: exigeOrigemCliente ? "Selecione o cliente do adiantamento de origem." : "Selecione o fornecedor do adiantamento de origem." };
  }
  if ((exigeDestinoCliente || exigeDestinoFornecedor) && !dados.destinoTerceiroId) {
    return { erro: exigeDestinoCliente ? "Selecione o cliente do adiantamento de destino." : "Selecione o fornecedor do adiantamento de destino." };
  }

  async function validarTerceiro(id: string | undefined, tipo: "cliente" | "fornecedor") {
    if (!id) return true;
    if (tipo === "cliente") return !!(await db.cliente.findFirst({ where: { id, grupoId } }));
    return !!(await db.fornecedor.findFirst({ where: { id, grupoId } }));
  }
  if (exigeOrigemCliente && !(await validarTerceiro(dados.origemTerceiroId, "cliente"))) return { erro: "Cliente do adiantamento de origem não encontrado." };
  if (exigeOrigemFornecedor && !(await validarTerceiro(dados.origemTerceiroId, "fornecedor"))) return { erro: "Fornecedor do adiantamento de origem não encontrado." };
  if (exigeDestinoCliente && !(await validarTerceiro(dados.destinoTerceiroId, "cliente"))) return { erro: "Cliente do adiantamento de destino não encontrado." };
  if (exigeDestinoFornecedor && !(await validarTerceiro(dados.destinoTerceiroId, "fornecedor"))) return { erro: "Fornecedor do adiantamento de destino não encontrado." };

  try {
    await registrarTransferencia({
      empresaId,
      contaOrigemId: dados.contaOrigemId,
      contaDestinoId: dados.contaDestinoId,
      tipoMovimento: dados.tipoMovimento,
      valor: new Prisma.Decimal(dados.valor),
      data: dados.data,
      historico: dados.historico,
      usuarioId: permissao.session.user.id,
      origemClienteId: exigeOrigemCliente ? dados.origemTerceiroId : undefined,
      origemFornecedorId: exigeOrigemFornecedor ? dados.origemTerceiroId : undefined,
      destinoClienteId: exigeDestinoCliente ? dados.destinoTerceiroId : undefined,
      destinoFornecedorId: exigeDestinoFornecedor ? dados.destinoTerceiroId : undefined,
    });
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Não foi possível registrar a transferência." };
  }

  revalidatePath("/transferencias-entre-contas");
  redirect("/transferencias-entre-contas");
}

const estornoSchema = z.object({
  motivo: z.string().trim().min(1, "Informe o motivo.").transform(normalizarTexto),
});

/** Estorna uma Transferência Entre Contas — cria a reversa e recredita/redebita o adiantamento se houver. */
export async function estornarTransferencia(
  transferenciaId: string,
  _prev: TransferenciaFormState,
  formData: FormData
): Promise<TransferenciaFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;
  const empresaId = permissao.session.user.empresaId!;

  const transferencia = await db.transferenciaEntreContas.findFirst({ where: { id: transferenciaId, empresaId } });
  if (!transferencia) return { erro: "Transferência não encontrada." };
  if (transferencia.estornada) return { erro: "Esta transferência já foi estornada." };

  const parsed = estornoSchema.safeParse({ motivo: formData.get("motivo") });
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  try {
    await registrarEstornoTransferencia({
      transferenciaId,
      motivo: parsed.data.motivo,
      dataEstorno: new Date(),
      usuarioId: permissao.session.user.id,
    });
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Não foi possível estornar a transferência." };
  }

  revalidatePath("/transferencias-entre-contas");
  return {};
}
