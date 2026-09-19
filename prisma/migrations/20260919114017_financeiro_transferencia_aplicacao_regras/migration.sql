/*
  Warnings:

  - You are about to drop the column `cliente_id` on the `transferencias_entre_contas` table. All the data in the column will be lost.
  - You are about to drop the column `fornecedor_id` on the `transferencias_entre_contas` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "transferencias_entre_contas" DROP CONSTRAINT "transferencias_entre_contas_cliente_id_fkey";

-- DropForeignKey
ALTER TABLE "transferencias_entre_contas" DROP CONSTRAINT "transferencias_entre_contas_fornecedor_id_fkey";

-- AlterTable
ALTER TABLE "movimentos_aplicacao" ADD COLUMN     "estornado_em" TIMESTAMP(3),
ADD COLUMN     "estornado_por_id" TEXT,
ADD COLUMN     "estorno_de_id" TEXT,
ADD COLUMN     "motivo_estorno" TEXT,
ADD COLUMN     "usuario_id" TEXT;

-- AlterTable
ALTER TABLE "parametros_financeiros" ADD COLUMN     "plano_emprestimo_id" TEXT;

-- AlterTable
ALTER TABLE "transferencias_entre_contas" DROP COLUMN "cliente_id",
DROP COLUMN "fornecedor_id",
ADD COLUMN     "destino_cliente_id" TEXT,
ADD COLUMN     "destino_fornecedor_id" TEXT,
ADD COLUMN     "origem_cliente_id" TEXT,
ADD COLUMN     "origem_fornecedor_id" TEXT;

-- AddForeignKey
ALTER TABLE "parametros_financeiros" ADD CONSTRAINT "parametros_financeiros_plano_emprestimo_id_fkey" FOREIGN KEY ("plano_emprestimo_id") REFERENCES "planos_financeiros"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transferencias_entre_contas" ADD CONSTRAINT "transferencias_entre_contas_origem_cliente_id_fkey" FOREIGN KEY ("origem_cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transferencias_entre_contas" ADD CONSTRAINT "transferencias_entre_contas_origem_fornecedor_id_fkey" FOREIGN KEY ("origem_fornecedor_id") REFERENCES "fornecedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transferencias_entre_contas" ADD CONSTRAINT "transferencias_entre_contas_destino_cliente_id_fkey" FOREIGN KEY ("destino_cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transferencias_entre_contas" ADD CONSTRAINT "transferencias_entre_contas_destino_fornecedor_id_fkey" FOREIGN KEY ("destino_fornecedor_id") REFERENCES "fornecedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentos_aplicacao" ADD CONSTRAINT "movimentos_aplicacao_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentos_aplicacao" ADD CONSTRAINT "movimentos_aplicacao_estornado_por_id_fkey" FOREIGN KEY ("estornado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentos_aplicacao" ADD CONSTRAINT "movimentos_aplicacao_estorno_de_id_fkey" FOREIGN KEY ("estorno_de_id") REFERENCES "movimentos_aplicacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
