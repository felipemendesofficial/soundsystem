-- AlterTable
ALTER TABLE "lancamentos_financeiros" ADD COLUMN     "cancelado_em" TIMESTAMP(3),
ADD COLUMN     "cancelado_por_id" TEXT,
ADD COLUMN     "grupo_parcelamento_id" TEXT,
ADD COLUMN     "motivo_cancelamento" TEXT,
ADD COLUMN     "numero_parcela" INTEGER,
ADD COLUMN     "total_parcelas" INTEGER;

-- CreateIndex
CREATE INDEX "lancamentos_financeiros_grupo_parcelamento_id_idx" ON "lancamentos_financeiros"("grupo_parcelamento_id");

-- AddForeignKey
ALTER TABLE "lancamentos_financeiros" ADD CONSTRAINT "lancamentos_financeiros_cancelado_por_id_fkey" FOREIGN KEY ("cancelado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
