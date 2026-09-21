"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { normalizarTexto } from "@/lib/texto";

export type ContaFinanceiraFormState = { erro?: string };

const schema = z.object({
  tipo: z.enum(["conta_corrente", "caixa", "fundo_fixo", "aplicacao"], { message: "Selecione o tipo." }),
  nome: z.string().trim().min(1, "Informe o nome.").transform(normalizarTexto),
  numeroConta: z.string().trim().transform(normalizarTexto).optional(),
  agencia: z.string().trim().transform(normalizarTexto).optional(),
  bancoId: z.string().trim().optional(),
  limiteCredito: z.coerce.number().nonnegative("Limite de crédito não pode ser negativo.").optional(),
  dataAbertura: z.coerce.date().optional(),
  valorFundoFixo: z.coerce.number().nonnegative("Valor do fundo fixo não pode ser negativo.").optional(),
  saldoInicial: z.coerce.number(),
  gerarBoleto: z.enum(["on"]).nullish(),
  adiantamentoCliente: z.enum(["on"]).nullish(),
  adiantamentoFornecedor: z.enum(["on"]).nullish(),
});

async function exigirPermissao() {
  const session = await auth();
  if (!session?.user) return { erro: "Não autenticado." } as const;
  if (!podeGerenciarFinanceiro(session.user.perfil)) {
    return { erro: "Seu perfil não pode gerenciar o Financeiro." } as const;
  }
  return { session } as const;
}

function toData(formData: FormData) {
  return schema.safeParse({
    tipo: formData.get("tipo"),
    nome: formData.get("nome"),
    numeroConta: formData.get("numeroConta"),
    agencia: formData.get("agencia"),
    bancoId: formData.get("bancoId"),
    limiteCredito: formData.get("limiteCredito") || undefined,
    dataAbertura: formData.get("dataAbertura") || undefined,
    valorFundoFixo: formData.get("valorFundoFixo") || undefined,
    saldoInicial: formData.get("saldoInicial") || 0,
    gerarBoleto: formData.get("gerarBoleto"),
    adiantamentoCliente: formData.get("adiantamentoCliente"),
    adiantamentoFornecedor: formData.get("adiantamentoFornecedor"),
  });
}

function montarDados(parsed: z.infer<typeof schema>) {
  return {
    tipo: parsed.tipo,
    nome: parsed.nome,
    numeroConta: parsed.numeroConta || null,
    agencia: parsed.agencia || null,
    bancoId: parsed.bancoId || null,
    limiteCredito: parsed.limiteCredito ?? null,
    dataAbertura: parsed.dataAbertura ?? null,
    valorFundoFixo: parsed.valorFundoFixo ?? null,
    saldoInicial: parsed.saldoInicial,
    gerarBoleto: parsed.gerarBoleto === "on",
    adiantamentoCliente: parsed.adiantamentoCliente === "on",
    adiantamentoFornecedor: parsed.adiantamentoFornecedor === "on",
  };
}

export async function criarContaFinanceira(
  _prev: ContaFinanceiraFormState,
  formData: FormData
): Promise<ContaFinanceiraFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;

  const parsed = toData(formData);
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const dados = montarDados(parsed.data);

  // Saldo atual nasce igual ao saldo inicial — a partir daqui só é alterado
  // pelo motor de movimentação (Baixa/Transferência/Aplicação), nunca por
  // edição direta do cadastro.
  await db.contaFinanceira.create({
    data: { ...dados, saldoAtual: dados.saldoInicial, empresaId: permissao.session.user.empresaId! },
  });

  revalidatePath("/contas-financeiras");
  redirect("/contas-financeiras");
}

export async function atualizarContaFinanceira(
  id: string,
  _prev: ContaFinanceiraFormState,
  formData: FormData
): Promise<ContaFinanceiraFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;

  const parsed = toData(formData);
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  // Tipo não pode mudar depois de criada (Baixa/Transferência/Aplicação já
  // validam contra o tipo original) — ignora o que veio no formulário e
  // nunca sobrescreve, mesmo que o form tenha mandado outro valor.
  const { tipo: _tipoIgnorado, ...dadosSemTipo } = montarDados(parsed.data);

  const { count } = await db.contaFinanceira.updateMany({
    where: { id, empresaId: permissao.session.user.empresaId! },
    data: dadosSemTipo,
  });
  if (count === 0) return { erro: "Conta Financeira não encontrada." };

  revalidatePath("/contas-financeiras");
  redirect("/contas-financeiras");
}

export async function alternarAtivoContaFinanceira(id: string, ativo: boolean) {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return;

  await db.contaFinanceira.updateMany({
    where: { id, empresaId: permissao.session.user.empresaId! },
    data: { ativo },
  });
  revalidatePath("/contas-financeiras");
}
