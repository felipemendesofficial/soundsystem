"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { normalizarTexto } from "@/lib/texto";

export type OperadoraFormState = { erro?: string };
export type TaxaFormState = { erro?: string };

async function exigirPermissao() {
  const session = await auth();
  if (!session?.user) return { erro: "Não autenticado." } as const;
  if (!podeGerenciarFinanceiro(session.user.perfil)) {
    return { erro: "Seu perfil não pode gerenciar o Financeiro." } as const;
  }
  return { session } as const;
}

// --- Operadora (dados institucionais) --------------------------------------

const operadoraSchema = z.object({
  descricao: z.string().trim().min(1, "Informe a descrição.").transform(normalizarTexto),
  email: z.string().trim().optional(),
  cnpj: z.string().trim().optional(),
  telefoneSuporte: z.string().trim().optional(),
  telefoneContato: z.string().trim().optional(),
  telefoneAutorizacao: z.string().trim().optional(),
  telefoneManutencao: z.string().trim().optional(),
  telefoneAntecipacao: z.string().trim().optional(),
  endereco: z.string().trim().optional(),
  numero: z.string().trim().optional(),
  complemento: z.string().trim().optional(),
  bairro: z.string().trim().optional(),
  cidade: z.string().trim().optional(),
  uf: z.string().trim().optional(),
  cep: z.string().trim().optional(),
  pais: z.string().trim().optional(),
  nomePais: z.string().trim().optional(),
});

function toOperadoraData(formData: FormData) {
  return operadoraSchema.safeParse({
    descricao: formData.get("descricao"),
    email: formData.get("email"),
    cnpj: formData.get("cnpj"),
    telefoneSuporte: formData.get("telefoneSuporte"),
    telefoneContato: formData.get("telefoneContato"),
    telefoneAutorizacao: formData.get("telefoneAutorizacao"),
    telefoneManutencao: formData.get("telefoneManutencao"),
    telefoneAntecipacao: formData.get("telefoneAntecipacao"),
    endereco: formData.get("endereco"),
    numero: formData.get("numero"),
    complemento: formData.get("complemento"),
    bairro: formData.get("bairro"),
    cidade: formData.get("cidade"),
    uf: formData.get("uf"),
    cep: formData.get("cep"),
    pais: formData.get("pais"),
    nomePais: formData.get("nomePais"),
  });
}

export async function criarOperadora(_prev: OperadoraFormState, formData: FormData): Promise<OperadoraFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;

  const parsed = toOperadoraData(formData);
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const operadora = await db.operadoraCartao.create({
    data: { ...parsed.data, empresaId: permissao.session.user.empresaId! },
  });

  revalidatePath("/operadoras-cartao");
  redirect(`/operadoras-cartao/${operadora.id}`);
}

export async function atualizarOperadora(
  id: string,
  _prev: OperadoraFormState,
  formData: FormData
): Promise<OperadoraFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;
  const empresaId = permissao.session.user.empresaId!;

  const parsed = toOperadoraData(formData);
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const { count } = await db.operadoraCartao.updateMany({ where: { id, empresaId }, data: parsed.data });
  if (count === 0) return { erro: "Operadora não encontrada." };

  revalidatePath("/operadoras-cartao");
  revalidatePath(`/operadoras-cartao/${id}`);
  redirect(`/operadoras-cartao/${id}`);
}

export async function alternarAtivoOperadora(id: string, ativo: boolean) {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return;
  const empresaId = permissao.session.user.empresaId!;

  await db.operadoraCartao.updateMany({ where: { id, empresaId }, data: { ativo } });
  revalidatePath("/operadoras-cartao");
  revalidatePath(`/operadoras-cartao/${id}`);
}

// --- Taxa (cruzamento Operadora × Bandeira × Modalidade) --------------------

const taxaSchema = z.object({
  bandeiraId: z.string().min(1, "Selecione a bandeira."),
  modalidade: z.enum(["debito", "credito", "pre_datado", "cdc_credito"], { message: "Selecione a modalidade." }),
  taxaAvista: z.coerce.number().nonnegative("Taxa não pode ser negativa."),
  taxaAntecipacao: z.coerce.number().nonnegative("Taxa não pode ser negativa."),
  taxaParcEstabelecimento: z.coerce.number().nonnegative("Taxa não pode ser negativa."),
  taxaParcCliente: z.coerce.number().nonnegative("Taxa não pode ser negativa."),
  nDias: z.coerce.number().int().nonnegative("Prazo não pode ser negativo."),
  tipoRepasse: z.enum(["dias_corridos", "mensal"], { message: "Selecione o tipo de repasse." }),
});

function toTaxaData(formData: FormData) {
  return taxaSchema.safeParse({
    bandeiraId: formData.get("bandeiraId"),
    modalidade: formData.get("modalidade"),
    taxaAvista: formData.get("taxaAvista"),
    taxaAntecipacao: formData.get("taxaAntecipacao"),
    taxaParcEstabelecimento: formData.get("taxaParcEstabelecimento"),
    taxaParcCliente: formData.get("taxaParcCliente"),
    nDias: formData.get("nDias"),
    tipoRepasse: formData.get("tipoRepasse"),
  });
}

/** Já existe uma linha ativa pra essa combinação Operadora × Bandeira × Modalidade — @@unique garante no banco, aqui só a mensagem amigável. */
const ERRO_TAXA_DUPLICADA = "Já existe uma configuração de taxas para esta combinação de bandeira e modalidade.";

export async function criarTaxa(
  operadoraId: string,
  _prev: TaxaFormState,
  formData: FormData
): Promise<TaxaFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;
  const empresaId = permissao.session.user.empresaId!;

  const operadora = await db.operadoraCartao.findFirst({ where: { id: operadoraId, empresaId } });
  if (!operadora) return { erro: "Operadora não encontrada." };

  const parsed = toTaxaData(formData);
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const bandeira = await db.bandeira.findFirst({ where: { id: parsed.data.bandeiraId, ativo: true } });
  if (!bandeira) return { erro: "Bandeira não encontrada." };

  try {
    await db.operadoraCartaoTaxa.create({
      data: {
        operadoraId,
        bandeiraId: parsed.data.bandeiraId,
        modalidade: parsed.data.modalidade,
        taxaAvista: new Prisma.Decimal(parsed.data.taxaAvista),
        taxaAntecipacao: new Prisma.Decimal(parsed.data.taxaAntecipacao),
        taxaParcEstabelecimento: new Prisma.Decimal(parsed.data.taxaParcEstabelecimento),
        taxaParcCliente: new Prisma.Decimal(parsed.data.taxaParcCliente),
        nDias: parsed.data.nDias,
        tipoRepasse: parsed.data.tipoRepasse,
      },
    });
  } catch {
    return { erro: ERRO_TAXA_DUPLICADA };
  }

  revalidatePath(`/operadoras-cartao/${operadoraId}`);
  redirect(`/operadoras-cartao/${operadoraId}`);
}

export async function atualizarTaxa(
  operadoraId: string,
  taxaId: string,
  _prev: TaxaFormState,
  formData: FormData
): Promise<TaxaFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;
  const empresaId = permissao.session.user.empresaId!;

  const operadora = await db.operadoraCartao.findFirst({ where: { id: operadoraId, empresaId } });
  if (!operadora) return { erro: "Operadora não encontrada." };

  const parsed = toTaxaData(formData);
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  try {
    const { count } = await db.operadoraCartaoTaxa.updateMany({
      where: { id: taxaId, operadoraId },
      data: {
        bandeiraId: parsed.data.bandeiraId,
        modalidade: parsed.data.modalidade,
        taxaAvista: new Prisma.Decimal(parsed.data.taxaAvista),
        taxaAntecipacao: new Prisma.Decimal(parsed.data.taxaAntecipacao),
        taxaParcEstabelecimento: new Prisma.Decimal(parsed.data.taxaParcEstabelecimento),
        taxaParcCliente: new Prisma.Decimal(parsed.data.taxaParcCliente),
        nDias: parsed.data.nDias,
        tipoRepasse: parsed.data.tipoRepasse,
      },
    });
    if (count === 0) return { erro: "Configuração de taxa não encontrada." };
  } catch {
    return { erro: ERRO_TAXA_DUPLICADA };
  }

  revalidatePath(`/operadoras-cartao/${operadoraId}`);
  redirect(`/operadoras-cartao/${operadoraId}`);
}

export async function alternarAtivoTaxa(operadoraId: string, taxaId: string, ativo: boolean) {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return;
  const empresaId = permissao.session.user.empresaId!;

  const operadora = await db.operadoraCartao.findFirst({ where: { id: operadoraId, empresaId } });
  if (!operadora) return;

  await db.operadoraCartaoTaxa.updateMany({ where: { id: taxaId, operadoraId }, data: { ativo } });
  revalidatePath(`/operadoras-cartao/${operadoraId}`);
}
