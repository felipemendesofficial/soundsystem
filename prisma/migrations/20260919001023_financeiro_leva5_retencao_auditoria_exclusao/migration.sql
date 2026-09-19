-- AlterTable
ALTER TABLE "baixas" ADD COLUMN     "retencoes" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "usuario_id" TEXT;

-- AlterTable
ALTER TABLE "lancamentos_financeiros" ADD COLUMN     "atualizado_em" TIMESTAMP(3),
ADD COLUMN     "atualizado_por_id" TEXT,
ADD COLUMN     "criado_por_id" TEXT;

-- AlterTable
ALTER TABLE "planos_financeiros" ADD COLUMN     "permite_retencao" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "lancamentos_financeiros" ADD CONSTRAINT "lancamentos_financeiros_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos_financeiros" ADD CONSTRAINT "lancamentos_financeiros_atualizado_por_id_fkey" FOREIGN KEY ("atualizado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "baixas" ADD CONSTRAINT "baixas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
