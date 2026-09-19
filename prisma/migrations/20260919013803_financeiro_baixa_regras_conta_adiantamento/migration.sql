-- AlterTable
ALTER TABLE "baixas" ADD COLUMN     "adiantamento_cliente_id" TEXT,
ADD COLUMN     "adiantamento_fornecedor_id" TEXT;

-- AddForeignKey
ALTER TABLE "baixas" ADD CONSTRAINT "baixas_adiantamento_cliente_id_fkey" FOREIGN KEY ("adiantamento_cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "baixas" ADD CONSTRAINT "baixas_adiantamento_fornecedor_id_fkey" FOREIGN KEY ("adiantamento_fornecedor_id") REFERENCES "fornecedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
