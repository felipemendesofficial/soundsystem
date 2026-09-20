CREATE SEQUENCE "ordens_producao_numero_seq" AS INTEGER;
ALTER TABLE "ordens_producao" ADD COLUMN "numero" INTEGER NOT NULL DEFAULT nextval('ordens_producao_numero_seq');
ALTER SEQUENCE "ordens_producao_numero_seq" OWNED BY "ordens_producao"."numero";
CREATE UNIQUE INDEX "ordens_producao_numero_key" ON "ordens_producao"("numero");
