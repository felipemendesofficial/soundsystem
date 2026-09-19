-- AlterTable
ALTER TABLE "pendencias_conciliacao" ADD COLUMN     "movimentacao_vinculada_id" TEXT;

-- AddForeignKey
ALTER TABLE "pendencias_conciliacao" ADD CONSTRAINT "pendencias_conciliacao_movimentacao_vinculada_id_fkey" FOREIGN KEY ("movimentacao_vinculada_id") REFERENCES "movimentacoes_financeiras"("id") ON DELETE SET NULL ON UPDATE CASCADE;
