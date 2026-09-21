-- AlterTable
ALTER TABLE "dados_cartao" ADD COLUMN     "bandeira_id" TEXT;

-- AddForeignKey
ALTER TABLE "dados_cartao" ADD CONSTRAINT "dados_cartao_bandeira_id_fkey" FOREIGN KEY ("bandeira_id") REFERENCES "bandeiras"("id") ON DELETE SET NULL ON UPDATE CASCADE;
