-- CreateEnum
CREATE TYPE "TipoLancamento" AS ENUM ('compra', 'devolucao_cliente', 'ajuste_entrada', 'venda', 'devolucao_fornecedor', 'perda_avaria', 'uso_interno', 'ajuste_saida', 'transferencia');

-- CreateEnum
CREATE TYPE "StatusLancamento" AS ENUM ('aberto', 'fechado');

-- AlterTable
ALTER TABLE "movimentacoes" ADD COLUMN     "lancamento_id" TEXT;

-- CreateTable
CREATE TABLE "lancamentos" (
    "id" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "tipo" "TipoLancamento" NOT NULL,
    "status" "StatusLancamento" NOT NULL DEFAULT 'aberto',
    "deposito_id" TEXT,
    "deposito_origem_id" TEXT,
    "deposito_destino_id" TEXT,
    "fornecedor_id" TEXT,
    "cliente_id" TEXT,
    "vendedor_id" TEXT,
    "usuario_id" TEXT NOT NULL,
    "observacao" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechado_em" TIMESTAMP(3),
    "reaberto_em" TIMESTAMP(3),

    CONSTRAINT "lancamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lancamento_itens" (
    "id" TEXT NOT NULL,
    "lancamento_id" TEXT NOT NULL,
    "produto_id" TEXT NOT NULL,
    "quantidade" DECIMAL(14,3) NOT NULL,
    "custo_unitario" DECIMAL(14,4),
    "preco_venda" DECIMAL(14,2),

    CONSTRAINT "lancamento_itens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lancamentos_numero_key" ON "lancamentos"("numero");

-- AddForeignKey
ALTER TABLE "movimentacoes" ADD CONSTRAINT "movimentacoes_lancamento_id_fkey" FOREIGN KEY ("lancamento_id") REFERENCES "lancamentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_deposito_id_fkey" FOREIGN KEY ("deposito_id") REFERENCES "depositos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_deposito_origem_id_fkey" FOREIGN KEY ("deposito_origem_id") REFERENCES "depositos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_deposito_destino_id_fkey" FOREIGN KEY ("deposito_destino_id") REFERENCES "depositos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_fornecedor_id_fkey" FOREIGN KEY ("fornecedor_id") REFERENCES "fornecedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "vendedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamento_itens" ADD CONSTRAINT "lancamento_itens_lancamento_id_fkey" FOREIGN KEY ("lancamento_id") REFERENCES "lancamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamento_itens" ADD CONSTRAINT "lancamento_itens_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
