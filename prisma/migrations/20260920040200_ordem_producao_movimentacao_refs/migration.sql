ALTER TABLE "ordens_producao" ADD COLUMN "movimentacao_entrada_id" TEXT;
ALTER TABLE "ordens_producao_materiais" ADD COLUMN "movimentacao_id" TEXT;

CREATE UNIQUE INDEX "ordens_producao_movimentacao_entrada_id_key" ON "ordens_producao"("movimentacao_entrada_id");
CREATE UNIQUE INDEX "ordens_producao_materiais_movimentacao_id_key" ON "ordens_producao_materiais"("movimentacao_id");
