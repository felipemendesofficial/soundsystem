/**
 * Normaliza texto livre antes de gravar no banco: maiusculo e sem acentos.
 * Usado em todo campo de digitacao (nome, SKU, endereco, observacao etc.) --
 * exceto email e senha, que precisam manter a grafia original.
 */
const REGEX_DIACRITICOS = /[̀-ͯ]/g;

export function normalizarTexto(valor: string): string {
  return valor.normalize("NFD").replace(REGEX_DIACRITICOS, "").toUpperCase();
}
