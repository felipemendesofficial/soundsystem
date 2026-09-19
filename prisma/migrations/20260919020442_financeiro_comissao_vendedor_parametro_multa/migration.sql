-- CreateEnum
CREATE TYPE "TipoMovimentoComissao" AS ENUM ('entrada', 'saida');

-- AlterTable
ALTER TABLE "parametros_financeiros" ADD COLUMN     "percentual_multa_padrao" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "vendedores" ADD COLUMN     "saldo_comissao" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "movimentacoes_comissao_vendedor" (
    "id" TEXT NOT NULL,
    "vendedor_id" TEXT NOT NULL,
    "tipo" "TipoMovimentoComissao" NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "saldo_anterior" DECIMAL(14,2) NOT NULL,
    "saldo_posterior" DECIMAL(14,2) NOT NULL,
    "comissao_id" TEXT NOT NULL,
    "baixa_id" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimentacoes_comissao_vendedor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "movimentacoes_comissao_vendedor_vendedor_id_criado_em_idx" ON "movimentacoes_comissao_vendedor"("vendedor_id", "criado_em");

-- AddForeignKey
ALTER TABLE "movimentacoes_comissao_vendedor" ADD CONSTRAINT "movimentacoes_comissao_vendedor_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "vendedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes_comissao_vendedor" ADD CONSTRAINT "movimentacoes_comissao_vendedor_comissao_id_fkey" FOREIGN KEY ("comissao_id") REFERENCES "comissoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes_comissao_vendedor" ADD CONSTRAINT "movimentacoes_comissao_vendedor_baixa_id_fkey" FOREIGN KEY ("baixa_id") REFERENCES "baixas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
