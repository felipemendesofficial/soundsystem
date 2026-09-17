-- DropIndex
DROP INDEX "baixas_lancamento_id_key";

-- CreateIndex
CREATE INDEX "baixas_lancamento_id_idx" ON "baixas"("lancamento_id");
