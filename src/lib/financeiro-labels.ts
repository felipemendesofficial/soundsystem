/** Rótulos em pt-BR dos enums de documento do Lançamento Financeiro — compartilhado entre o formulário e a tela de detalhe. */
export const TIPOS_DOCUMENTO_LABEL: Record<string, string> = {
  especie: "Espécie",
  cheque_vista: "Cheque à Vista",
  cheque_prazo: "Cheque a Prazo",
  cheque_devolvido: "Cheque Devolvido",
  deposito_cartorio: "Depósito em Cartório",
  nota_promissoria: "Nota Promissória",
  deposito_bancario: "Depósito Bancário",
  pix: "Pix",
  cartao: "Cartão",
};

export const TIPOS_TAXA_CARTAO_LABEL: Record<string, string> = {
  a_vista: "À Vista",
  antecipacao: "Antecipação",
  parc_estabelecimento: "Parcelado — Estabelecimento",
  parc_cliente: "Parcelado — Cliente",
};

/** Modalidade de cartão nas taxas de Operadora × Bandeira. */
export const TIPOS_CARTAO_MODALIDADE_LABEL: Record<string, string> = {
  debito: "Débito",
  credito: "Crédito",
  pre_datado: "Pré-datado",
  cdc_credito: "CDC-Crédito",
};

/** Prazo de repasse das taxas de Operadora de Cartão. */
export const TIPOS_REPASSE_LABEL: Record<string, string> = {
  dias_corridos: "Dias Corridos",
  mensal: "Mensal",
};
