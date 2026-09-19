import type { TipoConta, TipoDocumento, TipoLancamentoFinanceiro } from "@/generated/prisma/client";

/**
 * Documentos que representam instrumento físico/promissório — nunca batem
 * direto em Conta Corrente/Aplicação neste sistema (a conciliação bancária
 * desses instrumentos é outro fluxo, fora desta leva).
 */
const DOCUMENTOS_SEM_CONTA_CORRENTE_OU_APLICACAO = new Set<TipoDocumento>([
  "especie",
  "cheque_vista",
  "cheque_prazo",
  "cheque_devolvido",
  "deposito_cartorio",
  "nota_promissoria",
]);

/** Documentos eletrônicos/bancários — nunca passam pelo Caixa físico. */
const DOCUMENTOS_SEM_CAIXA = new Set<TipoDocumento>(["cartao", "pix", "deposito_bancario"]);

export type ContaParaRegraBaixa = {
  tipo: TipoConta;
  adiantamentoCliente: boolean;
  adiantamentoFornecedor: boolean;
};

/**
 * Regra de compatibilidade conta × tipo de documento × despesa/receita pra
 * Baixa (pedido do usuário, 2026-09-19). Devolve a mensagem de erro quando a
 * conta não pode ser usada, ou `null` quando pode — usada tanto pra filtrar
 * a lista de contas mostrada quanto pra validar no servidor.
 */
export function erroContaParaBaixa(
  conta: ContaParaRegraBaixa,
  contexto: { tipoLancamento: TipoLancamentoFinanceiro; tipoDocumento: TipoDocumento }
): string | null {
  const { tipoLancamento, tipoDocumento } = contexto;

  if (tipoLancamento === "despesa" && conta.adiantamentoCliente) {
    return "Uma despesa não pode ser baixada numa conta de Adiantamento de Cliente.";
  }
  if (tipoLancamento === "receita" && conta.adiantamentoFornecedor) {
    return "Uma receita não pode ser baixada numa conta de Adiantamento de Fornecedor.";
  }
  if (tipoLancamento === "receita" && conta.tipo === "fundo_fixo") {
    return "Fundo Fixo não pode ser usado para baixa de receita.";
  }
  if (
    DOCUMENTOS_SEM_CONTA_CORRENTE_OU_APLICACAO.has(tipoDocumento) &&
    (conta.tipo === "conta_corrente" || conta.tipo === "aplicacao")
  ) {
    return "Este tipo de documento não pode ser baixado em Conta Corrente ou Aplicação.";
  }
  if (DOCUMENTOS_SEM_CAIXA.has(tipoDocumento) && conta.tipo === "caixa") {
    return "Este tipo de documento não pode ser baixado no Caixa.";
  }

  return null;
}
