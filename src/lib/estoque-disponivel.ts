import { db } from "@/lib/db";

/**
 * Agrupa por depósito os produtos com saldo positivo na empresa — usado pelos
 * formulários de Lançamento e Ordem de Serviço pra restringir a escolha de
 * produtos, nos tipos que dão saída de estoque, aos que realmente têm saldo
 * disponível no depósito selecionado.
 */
export async function obterProdutosComEstoquePorDeposito(empresaId: string): Promise<Record<string, string[]>> {
  const linhas = await db.produtoEstoque.findMany({
    where: { empresaId, quantidadeSaldo: { gt: 0 } },
    select: { produtoId: true, depositoId: true },
  });

  const porDeposito: Record<string, string[]> = {};
  for (const linha of linhas) {
    (porDeposito[linha.depositoId] ??= []).push(linha.produtoId);
  }
  return porDeposito;
}
