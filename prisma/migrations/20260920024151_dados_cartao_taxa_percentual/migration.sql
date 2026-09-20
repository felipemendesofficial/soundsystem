-- AlterTable
ALTER TABLE "dados_cartao" ADD COLUMN     "operadora_cartao_taxa_id" TEXT,
ADD COLUMN     "percentual_aplicado" DECIMAL(5,2);

-- AddForeignKey
ALTER TABLE "dados_cartao" ADD CONSTRAINT "dados_cartao_operadora_cartao_taxa_id_fkey" FOREIGN KEY ("operadora_cartao_taxa_id") REFERENCES "operadora_cartao_taxas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
