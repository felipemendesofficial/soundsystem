import type { TipoConta, TipoMovimentoTransferencia } from "@/generated/prisma/client";

/**
 * Matriz de compatibilidade conta × tipo de Transferência (pedido do
 * usuário, 2026-09-19). Contas do tipo `aplicacao` nunca aparecem em
 * nenhuma Transferência — só em MovimentoAplicacao (src/lib/regras-conta-aplicacao.ts).
 * "Inclusive adiantamento" só nos dois casos explicitamente citados; todo o
 * resto exclui conta flagada `adiantamentoCliente`/`adiantamentoFornecedor`
 * por padrão (leitura conservadora — revisar com o usuário se divergir).
 */
export type RegraTransferencia = {
  semOrigem: boolean;
  origemTipos: TipoConta[];
  origemPermiteAdiantamento: boolean;
  destinoTipos: TipoConta[];
  destinoPermiteAdiantamento: boolean;
  /** Só `emprestimo_contraido_banco` — precisa de ParametroFinanceiro.planoEmprestimoId. */
  afetaFluxoDeCaixa: boolean;
};

export const REGRAS_TRANSFERENCIA: Record<TipoMovimentoTransferencia, RegraTransferencia> = {
  transferencia_geral: {
    semOrigem: false,
    origemTipos: ["conta_corrente"],
    origemPermiteAdiantamento: false,
    destinoTipos: ["conta_corrente"],
    destinoPermiteAdiantamento: false,
    afetaFluxoDeCaixa: false,
  },
  reposicao_fundo_fixo: {
    semOrigem: false,
    origemTipos: ["conta_corrente", "caixa"],
    origemPermiteAdiantamento: false,
    destinoTipos: ["fundo_fixo"],
    destinoPermiteAdiantamento: false,
    afetaFluxoDeCaixa: false,
  },
  saldo_caixa_banco: {
    semOrigem: false,
    origemTipos: ["caixa"],
    origemPermiteAdiantamento: false,
    destinoTipos: ["conta_corrente"],
    destinoPermiteAdiantamento: true,
    afetaFluxoDeCaixa: false,
  },
  emprestimo_contraido_banco: {
    semOrigem: true,
    origemTipos: [],
    origemPermiteAdiantamento: false,
    destinoTipos: ["conta_corrente"],
    destinoPermiteAdiantamento: false,
    afetaFluxoDeCaixa: true,
  },
  transferencia_entre_caixas: {
    semOrigem: false,
    origemTipos: ["caixa"],
    origemPermiteAdiantamento: false,
    destinoTipos: ["caixa"],
    destinoPermiteAdiantamento: false,
    afetaFluxoDeCaixa: false,
  },
  transferencia_banco_para_caixa: {
    semOrigem: false,
    origemTipos: ["conta_corrente"],
    origemPermiteAdiantamento: true,
    destinoTipos: ["caixa"],
    destinoPermiteAdiantamento: false,
    afetaFluxoDeCaixa: false,
  },
};

export type ContaParaRegraTransferencia = {
  tipo: TipoConta;
  adiantamentoCliente: boolean;
  adiantamentoFornecedor: boolean;
};

function contaEhAdiantamento(conta: ContaParaRegraTransferencia) {
  return conta.adiantamentoCliente || conta.adiantamentoFornecedor;
}

/** Devolve a mensagem de erro se `conta` não pode ser a origem desse tipo de Transferência, ou `null` se pode. */
export function erroContaOrigemTransferencia(
  conta: ContaParaRegraTransferencia,
  tipoMovimento: TipoMovimentoTransferencia
): string | null {
  const regra = REGRAS_TRANSFERENCIA[tipoMovimento];
  if (conta.tipo === "aplicacao") return "Conta de Aplicação não pode ser usada em Transferência entre Contas.";
  if (!regra.origemTipos.includes(conta.tipo)) return "Essa conta não é uma origem válida pra esse tipo de transferência.";
  if (!regra.origemPermiteAdiantamento && contaEhAdiantamento(conta)) {
    return "Esse tipo de transferência não permite conta de Adiantamento como origem.";
  }
  return null;
}

/** Devolve a mensagem de erro se `conta` não pode ser o destino desse tipo de Transferência, ou `null` se pode. */
export function erroContaDestinoTransferencia(
  conta: ContaParaRegraTransferencia,
  tipoMovimento: TipoMovimentoTransferencia
): string | null {
  const regra = REGRAS_TRANSFERENCIA[tipoMovimento];
  if (conta.tipo === "aplicacao") return "Conta de Aplicação não pode ser usada em Transferência entre Contas.";
  if (!regra.destinoTipos.includes(conta.tipo)) return "Essa conta não é um destino válido pra esse tipo de transferência.";
  if (!regra.destinoPermiteAdiantamento && contaEhAdiantamento(conta)) {
    return "Esse tipo de transferência não permite conta de Adiantamento como destino.";
  }
  return null;
}
