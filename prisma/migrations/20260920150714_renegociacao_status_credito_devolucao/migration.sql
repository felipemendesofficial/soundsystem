/*
  Warnings:

  - Added the required column `data_emissao` to the `renegociacoes_destinos` table without a default value. This is not possible if the table is not empty.
  - Added the required column `data_vencimento` to the `renegociacoes_destinos` table without a default value. This is not possible if the table is not empty.
  - Added the required column `historico_simplificado` to the `renegociacoes_destinos` table without a default value. This is not possible if the table is not empty.
  - Added the required column `processo_id` to the `renegociacoes_destinos` table without a default value. This is not possible if the table is not empty.
  - Added the required column `processo_item_id` to the `renegociacoes_destinos` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tipo_documento` to the `renegociacoes_destinos` table without a default value. This is not possible if the table is not empty.
  - Added the required column `valor_original` to the `renegociacoes_destinos` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "StatusRenegociacao" AS ENUM ('aberta', 'fechada', 'cancelada', 'estornada');

-- DropForeignKey
ALTER TABLE "renegociacoes_destinos" DROP CONSTRAINT "renegociacoes_destinos_lancamento_id_fkey";

-- DropIndex
DROP INDEX "renegociacoes_empresa_id_idx";

-- DropIndex
DROP INDEX "renegociacoes_origens_lancamento_id_key";

-- AlterTable
ALTER TABLE "clientes" ADD COLUMN     "documento" TEXT;

-- AlterTable
ALTER TABLE "renegociacoes" ADD COLUMN     "estornado_em" TIMESTAMP(3),
ADD COLUMN     "fechado_em" TIMESTAMP(3),
ADD COLUMN     "status" "StatusRenegociacao" NOT NULL DEFAULT 'aberta';

-- AlterTable
ALTER TABLE "renegociacoes_destinos" ADD COLUMN     "cliente_id" TEXT,
ADD COLUMN     "data_emissao" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "data_vencimento" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "fornecedor_id" TEXT,
ADD COLUMN     "historico_simplificado" TEXT NOT NULL,
ADD COLUMN     "processo_id" TEXT NOT NULL,
ADD COLUMN     "processo_item_id" TEXT NOT NULL,
ADD COLUMN     "tipo_documento" "TipoDocumento" NOT NULL,
ADD COLUMN     "valor_original" DECIMAL(14,2) NOT NULL,
ALTER COLUMN "lancamento_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "creditos_devolucao" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "lancamento_id" TEXT NOT NULL,
    "fornecedor_id" TEXT,
    "cliente_id" TEXT,
    "valor_original" DECIMAL(14,2) NOT NULL,
    "saldo_disponivel" DECIMAL(14,2) NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "creditos_devolucao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creditos_devolucao_utilizados" (
    "id" TEXT NOT NULL,
    "credito_devolucao_id" TEXT NOT NULL,
    "renegociacao_id" TEXT NOT NULL,
    "valor_utilizado" DECIMAL(14,2) NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "creditos_devolucao_utilizados_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "creditos_devolucao_lancamento_id_key" ON "creditos_devolucao"("lancamento_id");

-- CreateIndex
CREATE INDEX "creditos_devolucao_fornecedor_id_idx" ON "creditos_devolucao"("fornecedor_id");

-- CreateIndex
CREATE INDEX "creditos_devolucao_cliente_id_idx" ON "creditos_devolucao"("cliente_id");

-- CreateIndex
CREATE INDEX "renegociacoes_empresa_id_status_idx" ON "renegociacoes"("empresa_id", "status");

-- AddForeignKey
ALTER TABLE "renegociacoes_destinos" ADD CONSTRAINT "renegociacoes_destinos_lancamento_id_fkey" FOREIGN KEY ("lancamento_id") REFERENCES "lancamentos_financeiros"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renegociacoes_destinos" ADD CONSTRAINT "renegociacoes_destinos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renegociacoes_destinos" ADD CONSTRAINT "renegociacoes_destinos_fornecedor_id_fkey" FOREIGN KEY ("fornecedor_id") REFERENCES "fornecedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renegociacoes_destinos" ADD CONSTRAINT "renegociacoes_destinos_processo_id_fkey" FOREIGN KEY ("processo_id") REFERENCES "processos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renegociacoes_destinos" ADD CONSTRAINT "renegociacoes_destinos_processo_item_id_fkey" FOREIGN KEY ("processo_item_id") REFERENCES "processo_itens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creditos_devolucao" ADD CONSTRAINT "creditos_devolucao_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creditos_devolucao" ADD CONSTRAINT "creditos_devolucao_lancamento_id_fkey" FOREIGN KEY ("lancamento_id") REFERENCES "lancamentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creditos_devolucao" ADD CONSTRAINT "creditos_devolucao_fornecedor_id_fkey" FOREIGN KEY ("fornecedor_id") REFERENCES "fornecedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creditos_devolucao" ADD CONSTRAINT "creditos_devolucao_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creditos_devolucao_utilizados" ADD CONSTRAINT "creditos_devolucao_utilizados_credito_devolucao_id_fkey" FOREIGN KEY ("credito_devolucao_id") REFERENCES "creditos_devolucao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creditos_devolucao_utilizados" ADD CONSTRAINT "creditos_devolucao_utilizados_renegociacao_id_fkey" FOREIGN KEY ("renegociacao_id") REFERENCES "renegociacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
