-- CreateTable
CREATE TABLE "categorias" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unidades_medida" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unidades_medida_pkey" PRIMARY KEY ("id")
);

-- Backfill categorias from the distinct values already used by produtos.categoria
INSERT INTO "categorias" ("id", "nome")
SELECT gen_random_uuid(), t."categoria"
FROM (SELECT DISTINCT "categoria" FROM "produtos" WHERE "categoria" IS NOT NULL) t;

-- Backfill unidades_medida from the distinct values already used by produtos.unidade_medida
INSERT INTO "unidades_medida" ("id", "nome")
SELECT gen_random_uuid(), t."unidade_medida"::text
FROM (SELECT DISTINCT "unidade_medida" FROM "produtos" WHERE "unidade_medida" IS NOT NULL) t;

-- AlterTable: add the new FK columns as nullable so existing rows can be backfilled first
ALTER TABLE "produtos" ADD COLUMN "categoria_id" TEXT;
ALTER TABLE "produtos" ADD COLUMN "unidade_medida_id" TEXT;

-- Backfill produtos FK columns from the old text/enum values
UPDATE "produtos" p SET "categoria_id" = c."id"
FROM "categorias" c WHERE c."nome" = p."categoria";

UPDATE "produtos" p SET "unidade_medida_id" = u."id"
FROM "unidades_medida" u WHERE u."nome" = p."unidade_medida"::text;

-- Now that every row is backfilled, enforce NOT NULL
ALTER TABLE "produtos" ALTER COLUMN "categoria_id" SET NOT NULL;
ALTER TABLE "produtos" ALTER COLUMN "unidade_medida_id" SET NOT NULL;

-- Drop the old columns and the now-unused enum type
ALTER TABLE "produtos" DROP COLUMN "categoria";
ALTER TABLE "produtos" DROP COLUMN "unidade_medida";
DROP TYPE "UnidadeMedida";

-- CreateIndex
CREATE UNIQUE INDEX "categorias_nome_key" ON "categorias"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "unidades_medida_nome_key" ON "unidades_medida"("nome");

-- AddForeignKey
ALTER TABLE "produtos" ADD CONSTRAINT "produtos_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produtos" ADD CONSTRAINT "produtos_unidade_medida_id_fkey" FOREIGN KEY ("unidade_medida_id") REFERENCES "unidades_medida"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
