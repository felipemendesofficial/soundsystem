-- CreateTable
CREATE TABLE "anexos_lancamento" (
    "id" TEXT NOT NULL,
    "lancamento_id" TEXT NOT NULL,
    "nome_arquivo" TEXT NOT NULL,
    "chave_storage" TEXT NOT NULL,
    "tipo_mime" TEXT NOT NULL,
    "tamanho_bytes" INTEGER NOT NULL,
    "enviado_por_id" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anexos_lancamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "anexos_lancamento_lancamento_id_idx" ON "anexos_lancamento"("lancamento_id");

-- AddForeignKey
ALTER TABLE "anexos_lancamento" ADD CONSTRAINT "anexos_lancamento_lancamento_id_fkey" FOREIGN KEY ("lancamento_id") REFERENCES "lancamentos_financeiros"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anexos_lancamento" ADD CONSTRAINT "anexos_lancamento_enviado_por_id_fkey" FOREIGN KEY ("enviado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
