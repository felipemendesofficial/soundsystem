-- AlterTable
ALTER TABLE "movimentacoes" ADD COLUMN     "ordem_producao_id" TEXT;

-- AddForeignKey
ALTER TABLE "movimentacoes" ADD CONSTRAINT "movimentacoes_ordem_producao_id_fkey" FOREIGN KEY ("ordem_producao_id") REFERENCES "ordens_producao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
