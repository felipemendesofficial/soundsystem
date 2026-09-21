"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { gerarUrlUpload, gerarUrlDownload, excluirObjeto, validarArquivo } from "@/lib/storage";

export type AnexoFormState = { erro?: string };

const REGRAS_ANEXO_LANCAMENTO = {
  tiposPermitidos: ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"],
  tamanhoMaximoBytes: 10 * 1024 * 1024,
} as const;

async function exigirPermissao() {
  const session = await auth();
  if (!session?.user) return { erro: "Não autenticado." } as const;
  if (!podeGerenciarFinanceiro(session.user.perfil)) {
    return { erro: "Seu perfil não pode gerenciar o Financeiro." } as const;
  }
  return { session } as const;
}

function sanitizarNomeArquivo(nome: string): string {
  return nome.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function prefixoStorage(empresaId: string, lancamentoId: string): string {
  return `empresas/${empresaId}/lancamentos-financeiros/${lancamentoId}/`;
}

/**
 * Passo 1 do upload: gera a URL assinada de PUT — o client faz o upload
 * direto pro bucket a partir daqui, o arquivo em si nunca passa pelo
 * servidor Next.js. Chamado direto do client component (não é um form
 * action tradicional), por isso a assinatura não segue o padrão
 * `(prevState, formData)`.
 */
export async function gerarUrlUploadAnexo(
  lancamentoId: string,
  nomeArquivo: string,
  tipoMime: string,
  tamanhoBytes: number
): Promise<{ url: string; chaveStorage: string } | { erro: string }> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return { erro: permissao.erro as string };
  const empresaId = permissao.session.user.empresaId!;

  const erroValidacao = validarArquivo({ tipoMime, tamanhoBytes }, REGRAS_ANEXO_LANCAMENTO);
  if (erroValidacao) return { erro: erroValidacao };

  const lancamento = await db.lancamentoFinanceiro.findFirst({ where: { id: lancamentoId, empresaId } });
  if (!lancamento) return { erro: "Lançamento não encontrado." };

  const chaveStorage = `${prefixoStorage(empresaId, lancamentoId)}${crypto.randomUUID()}-${sanitizarNomeArquivo(nomeArquivo)}`;
  try {
    const url = await gerarUrlUpload(chaveStorage, tipoMime);
    return { url, chaveStorage };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Não foi possível gerar a URL de upload." };
  }
}

/**
 * Passo 2: confirma o anexo depois do upload ao bucket ter dado certo — sem
 * checagem de status do lançamento aqui, anexar é sempre permitido (o
 * comprovante de baixa só existe depois de baixado, o de estorno só depois
 * de estornado). Confere que a chaveStorage realmente pertence a esse
 * lançamento/empresa antes de gravar — nunca aceita uma chave arbitrária
 * vinda do client (mesmo raciocínio de nunca resolver tenant por FK sem
 * checar, ver a auditoria multi-tenant em CLAUDE.md).
 */
export async function confirmarAnexoLancamento(
  lancamentoId: string,
  nomeArquivo: string,
  chaveStorage: string,
  tipoMime: string,
  tamanhoBytes: number
): Promise<AnexoFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;
  const empresaId = permissao.session.user.empresaId!;

  const lancamento = await db.lancamentoFinanceiro.findFirst({ where: { id: lancamentoId, empresaId } });
  if (!lancamento) return { erro: "Lançamento não encontrado." };

  if (!chaveStorage.startsWith(prefixoStorage(empresaId, lancamentoId))) {
    return { erro: "Chave de armazenamento inválida." };
  }

  await db.anexoLancamento.create({
    data: { lancamentoId, nomeArquivo, chaveStorage, tipoMime, tamanhoBytes, enviadoPorId: permissao.session.user.id },
  });

  revalidatePath(`/lancamentos-financeiros/${lancamentoId}`);
  return {};
}

/** URL assinada de visualização/download — gerada sob demanda a partir da tela de detalhe (server component), nunca cacheada. */
export async function gerarUrlVisualizacaoAnexo(chaveStorage: string): Promise<string> {
  return gerarUrlDownload(chaveStorage);
}

/**
 * Remove um anexo — só permitido enquanto o título ainda está `aberto`
 * (documentos de título já baixado/estornado/renegociado/cancelado fazem
 * parte do histórico e não podem sumir).
 */
export async function removerAnexoLancamento(
  anexoId: string,
  _prev: AnexoFormState,
  _formData: FormData
): Promise<AnexoFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;
  const empresaId = permissao.session.user.empresaId!;

  const anexo = await db.anexoLancamento.findFirst({
    where: { id: anexoId, lancamento: { empresaId } },
    include: { lancamento: true },
  });
  if (!anexo) return { erro: "Anexo não encontrado." };
  if (anexo.lancamento.status !== "aberto") {
    return {
      erro: "Não é possível remover anexos de um título que já foi baixado, estornado, renegociado ou cancelado — o comprovante faz parte do histórico.",
    };
  }

  try {
    await excluirObjeto(anexo.chaveStorage);
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Não foi possível remover o arquivo do armazenamento." };
  }
  await db.anexoLancamento.delete({ where: { id: anexoId } });

  revalidatePath(`/lancamentos-financeiros/${anexo.lancamentoId}`);
  return {};
}
