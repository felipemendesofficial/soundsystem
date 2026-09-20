-- AlterTable
ALTER TABLE "dados_cartao" ADD COLUMN     "operadora_id" TEXT;

-- AddForeignKey
ALTER TABLE "dados_cartao" ADD CONSTRAINT "dados_cartao_operadora_id_fkey" FOREIGN KEY ("operadora_id") REFERENCES "operadoras_cartao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
