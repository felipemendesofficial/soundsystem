-- AlterTable
ALTER TABLE "clientes" ADD COLUMN     "tabela_preco_padrao_id" TEXT;

-- CreateTable
CREATE TABLE "tabelas_preco" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tabelas_preco_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tabela_preco_itens" (
    "id" TEXT NOT NULL,
    "tabela_preco_id" TEXT NOT NULL,
    "produto_id" TEXT NOT NULL,
    "preco" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "tabela_preco_itens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tabelas_preco_nome_key" ON "tabelas_preco"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "tabela_preco_itens_tabela_preco_id_produto_id_key" ON "tabela_preco_itens"("tabela_preco_id", "produto_id");

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_tabela_preco_padrao_id_fkey" FOREIGN KEY ("tabela_preco_padrao_id") REFERENCES "tabelas_preco"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tabela_preco_itens" ADD CONSTRAINT "tabela_preco_itens_tabela_preco_id_fkey" FOREIGN KEY ("tabela_preco_id") REFERENCES "tabelas_preco"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tabela_preco_itens" ADD CONSTRAINT "tabela_preco_itens_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
