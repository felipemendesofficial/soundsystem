/*
  Warnings:

  - You are about to drop the column `terceiro_cliente_id` on the `dados_cheque` table. All the data in the column will be lost.
  - You are about to drop the column `terceiro_fornecedor_id` on the `dados_cheque` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "dados_cheque" DROP CONSTRAINT "dados_cheque_terceiro_cliente_id_fkey";

-- DropForeignKey
ALTER TABLE "dados_cheque" DROP CONSTRAINT "dados_cheque_terceiro_fornecedor_id_fkey";

-- AlterTable
ALTER TABLE "dados_cheque" DROP COLUMN "terceiro_cliente_id",
DROP COLUMN "terceiro_fornecedor_id",
ADD COLUMN     "terceiro" TEXT;
