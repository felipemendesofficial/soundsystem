-- AlterEnum
ALTER TYPE "TipoMovimento" ADD VALUE 'os_saida';

-- CreateEnum
CREATE TYPE "StatusOS" AS ENUM ('aberta', 'em_andamento', 'concluida', 'cancelada');

-- CreateTable
CREATE TABLE "servicos" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "preco_padrao" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "servicos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordens_servico" (
    "id" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "deposito_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "status" "StatusOS" NOT NULL DEFAULT 'aberta',
    "observacao" TEXT,
    "criada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluida_em" TIMESTAMP(3),

    CONSTRAINT "ordens_servico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "os_itens_produto" (
    "id" TEXT NOT NULL,
    "ordem_servico_id" TEXT NOT NULL,
    "produto_id" TEXT NOT NULL,
    "quantidade" DECIMAL(14,3) NOT NULL,
    "preco_unitario" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "os_itens_produto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "os_itens_servico" (
    "id" TEXT NOT NULL,
    "ordem_servico_id" TEXT NOT NULL,
    "servico_id" TEXT NOT NULL,
    "quantidade" DECIMAL(14,3) NOT NULL DEFAULT 1,
    "preco_unitario" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "os_itens_servico_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "movimentacoes" ADD COLUMN "ordem_servico_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "servicos_nome_key" ON "servicos"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "ordens_servico_numero_key" ON "ordens_servico"("numero");

-- AddForeignKey
ALTER TABLE "ordens_servico" ADD CONSTRAINT "ordens_servico_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordens_servico" ADD CONSTRAINT "ordens_servico_deposito_id_fkey" FOREIGN KEY ("deposito_id") REFERENCES "depositos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordens_servico" ADD CONSTRAINT "ordens_servico_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "os_itens_produto" ADD CONSTRAINT "os_itens_produto_ordem_servico_id_fkey" FOREIGN KEY ("ordem_servico_id") REFERENCES "ordens_servico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "os_itens_produto" ADD CONSTRAINT "os_itens_produto_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "os_itens_servico" ADD CONSTRAINT "os_itens_servico_ordem_servico_id_fkey" FOREIGN KEY ("ordem_servico_id") REFERENCES "ordens_servico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "os_itens_servico" ADD CONSTRAINT "os_itens_servico_servico_id_fkey" FOREIGN KEY ("servico_id") REFERENCES "servicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes" ADD CONSTRAINT "movimentacoes_ordem_servico_id_fkey" FOREIGN KEY ("ordem_servico_id") REFERENCES "ordens_servico"("id") ON DELETE SET NULL ON UPDATE CASCADE;
