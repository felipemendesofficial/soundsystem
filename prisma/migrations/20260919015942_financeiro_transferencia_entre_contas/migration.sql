-- AlterTable
ALTER TABLE "transferencias_entre_contas" ADD COLUMN     "estornado_em" TIMESTAMP(3),
ADD COLUMN     "estornado_por_id" TEXT,
ADD COLUMN     "estorno_de_id" TEXT,
ADD COLUMN     "motivo_estorno" TEXT,
ADD COLUMN     "usuario_id" TEXT;

-- AddForeignKey
ALTER TABLE "transferencias_entre_contas" ADD CONSTRAINT "transferencias_entre_contas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transferencias_entre_contas" ADD CONSTRAINT "transferencias_entre_contas_estornado_por_id_fkey" FOREIGN KEY ("estornado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transferencias_entre_contas" ADD CONSTRAINT "transferencias_entre_contas_estorno_de_id_fkey" FOREIGN KEY ("estorno_de_id") REFERENCES "transferencias_entre_contas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
