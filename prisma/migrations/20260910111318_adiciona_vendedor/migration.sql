-- CreateEnum
CREATE TYPE "TipoComissao" AS ENUM ('percentual', 'fixa');

-- CreateTable
CREATE TABLE "vendedores" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "recebe_comissao" BOOLEAN NOT NULL DEFAULT false,
    "tipo_comissao" "TipoComissao",
    "valor_comissao" DECIMAL(14,4),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendedores_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "movimentacoes" ADD COLUMN     "vendedor_id" TEXT;

-- AlterTable
ALTER TABLE "ordens_servico" ADD COLUMN     "vendedor_id" TEXT;

-- Backfill: OS pré-existentes ganham um vendedor placeholder inativo (não
-- aparece como opção em novos lançamentos) para permitir a coluna NOT NULL.
INSERT INTO "vendedores" ("id", "nome", "ativo", "recebe_comissao")
VALUES ('00000000-0000-0000-0000-000000000000', 'Não informado (histórico)', false, false);

UPDATE "ordens_servico" SET "vendedor_id" = '00000000-0000-0000-0000-000000000000' WHERE "vendedor_id" IS NULL;

ALTER TABLE "ordens_servico" ALTER COLUMN "vendedor_id" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "movimentacoes" ADD CONSTRAINT "movimentacoes_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "vendedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordens_servico" ADD CONSTRAINT "ordens_servico_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "vendedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
