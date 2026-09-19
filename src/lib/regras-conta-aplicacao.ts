import type { TipoConta } from "@/generated/prisma/client";

/**
 * Regra de MovimentoAplicacao (pedido do usuário, 2026-09-19): o lado "comum"
 * (de onde sai a aplicação, ou pra onde volta o resgate) só pode ser Conta
 * Corrente — nunca Caixa nem Fundo Fixo. Registro de Rendimento não tem lado
 * comum (só credita a própria conta de aplicação).
 */
export function erroContaComumParaAplicacao(tipo: TipoConta): string | null {
  if (tipo !== "conta_corrente") {
    return "Só Conta Corrente pode ser usada em Aplicação/Resgate.";
  }
  return null;
}
