-- CreateEnum
CREATE TYPE "Perfil" AS ENUM ('admin', 'estoquista', 'vendedor');

-- CreateEnum
CREATE TYPE "TipoPessoa" AS ENUM ('fisica', 'juridica');

-- CreateEnum
CREATE TYPE "TipoCliente" AS ENUM ('varejista', 'atacadista');

-- CreateEnum
CREATE TYPE "EstadoConservacao" AS ENUM ('excelente', 'bom', 'regular', 'para_reparo');

-- CreateEnum
CREATE TYPE "UnidadeMedida" AS ENUM ('unidade', 'metro', 'kit');

-- CreateEnum
CREATE TYPE "TipoMovimento" AS ENUM ('compra', 'devolucao_cliente', 'ajuste_entrada', 'transferencia_entrada', 'venda', 'devolucao_fornecedor', 'perda_avaria', 'uso_interno', 'ajuste_saida', 'transferencia_saida');

-- CreateTable
CREATE TABLE "depositos" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "endereco" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "depositos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "perfil" "Perfil" NOT NULL DEFAULT 'vendedor',
    "deposito_padrao_id" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fornecedores" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo_pessoa" "TipoPessoa" NOT NULL,
    "documento" TEXT,
    "telefone" TEXT,
    "email" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fornecedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo_cliente" "TipoCliente" NOT NULL,
    "telefone" TEXT,
    "email" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "produtos" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "marca" TEXT,
    "modelo" TEXT,
    "estado_conservacao" "EstadoConservacao" NOT NULL,
    "unidade_medida" "UnidadeMedida" NOT NULL,
    "foto_url" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "produtos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "produto_estoque" (
    "id" TEXT NOT NULL,
    "produto_id" TEXT NOT NULL,
    "deposito_id" TEXT NOT NULL,
    "quantidade_saldo" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "custo_medio_atual" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "valor_total_saldo" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "produto_estoque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimentacoes" (
    "id" TEXT NOT NULL,
    "produto_id" TEXT NOT NULL,
    "deposito_id" TEXT NOT NULL,
    "tipo_movimento" "TipoMovimento" NOT NULL,
    "data_movimento" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quantidade" DECIMAL(14,3) NOT NULL,
    "custo_unitario" DECIMAL(14,4),
    "custo_medio_apos" DECIMAL(14,4) NOT NULL,
    "saldo_quantidade_apos" DECIMAL(14,3) NOT NULL,
    "saldo_valor_apos" DECIMAL(14,2) NOT NULL,
    "preco_venda" DECIMAL(14,2),
    "cliente_id" TEXT,
    "fornecedor_id" TEXT,
    "usuario_id" TEXT NOT NULL,
    "observacao" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimentacoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "produtos_sku_key" ON "produtos"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "produto_estoque_produto_id_deposito_id_key" ON "produto_estoque"("produto_id", "deposito_id");

-- CreateIndex
CREATE INDEX "movimentacoes_produto_id_deposito_id_data_movimento_idx" ON "movimentacoes"("produto_id", "deposito_id", "data_movimento");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_deposito_padrao_id_fkey" FOREIGN KEY ("deposito_padrao_id") REFERENCES "depositos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produto_estoque" ADD CONSTRAINT "produto_estoque_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produto_estoque" ADD CONSTRAINT "produto_estoque_deposito_id_fkey" FOREIGN KEY ("deposito_id") REFERENCES "depositos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes" ADD CONSTRAINT "movimentacoes_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes" ADD CONSTRAINT "movimentacoes_deposito_id_fkey" FOREIGN KEY ("deposito_id") REFERENCES "depositos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes" ADD CONSTRAINT "movimentacoes_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes" ADD CONSTRAINT "movimentacoes_fornecedor_id_fkey" FOREIGN KEY ("fornecedor_id") REFERENCES "fornecedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes" ADD CONSTRAINT "movimentacoes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
