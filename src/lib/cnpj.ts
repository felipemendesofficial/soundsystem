/**
 * Radical do CNPJ — os 8 primeiros dígitos, que identificam a empresa
 * (matriz e filiais compartilham o radical, só a ordem/dígito verificador
 * muda). Usado pra permitir que uma Renegociação junte títulos de
 * fornecedores/clientes diferentes desde que sejam filiais da mesma empresa.
 * Retorna `null` pra CPF (11 dígitos) ou documento vazio/inválido — nesses
 * casos só o mesmo cadastro exato pode ser misturado, nunca por radical.
 */
export function radicalCnpj(documento: string | null | undefined): string | null {
  if (!documento) return null;
  const digitos = documento.replace(/\D/g, "");
  if (digitos.length !== 14) return null;
  return digitos.slice(0, 8);
}

/** Chave de agrupamento pra Renegociação: radical do CNPJ quando existir, senão o próprio id do cadastro (só mistura com ele mesmo). */
export function chaveAgrupamentoTerceiro(id: string, documento: string | null | undefined): string {
  const radical = radicalCnpj(documento);
  return radical ? `cnpj:${radical}` : `id:${id}`;
}
