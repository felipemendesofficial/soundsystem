-- AlterTable
ALTER TABLE "movimentacoes" ADD COLUMN     "estornado_em" TIMESTAMP(3),
ADD COLUMN     "estorno_de_id" TEXT;

-- AddForeignKey
ALTER TABLE "movimentacoes" ADD CONSTRAINT "movimentacoes_estorno_de_id_fkey" FOREIGN KEY ("estorno_de_id") REFERENCES "movimentacoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
