-- CreateEnum
CREATE TYPE "TipoCartaoModalidade" AS ENUM ('debito', 'credito', 'pre_datado', 'cdc_credito');

-- CreateEnum
CREATE TYPE "TipoRepasse" AS ENUM ('dias_corridos', 'mensal');

-- AlterTable
ALTER TABLE "contas_financeiras" ADD COLUMN     "banco_id" TEXT;

-- CreateTable
CREATE TABLE "bancos" (
    "id" TEXT NOT NULL,
    "codigo_compe" TEXT,
    "ispb" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "nome_completo" TEXT,
    "participa_compe" BOOLEAN NOT NULL DEFAULT true,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bancos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bandeiras" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "bandeiras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operadoras_cartao" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "data_cadastro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "email" TEXT,
    "cnpj" TEXT,
    "telefone_suporte" TEXT,
    "telefone_contato" TEXT,
    "telefone_autorizacao" TEXT,
    "telefone_manutencao" TEXT,
    "telefone_antecipacao" TEXT,
    "endereco" TEXT,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT,
    "cidade" TEXT,
    "uf" TEXT,
    "cep" TEXT,
    "pais" TEXT,
    "nome_pais" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "operadoras_cartao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operadora_cartao_taxas" (
    "id" TEXT NOT NULL,
    "operadora_id" TEXT NOT NULL,
    "bandeira_id" TEXT NOT NULL,
    "modalidade" "TipoCartaoModalidade" NOT NULL,
    "taxa_avista" DECIMAL(5,2) NOT NULL,
    "taxa_antecipacao" DECIMAL(5,2) NOT NULL,
    "taxa_parc_estabelecimento" DECIMAL(5,2) NOT NULL,
    "taxa_parc_cliente" DECIMAL(5,2) NOT NULL,
    "n_dias" INTEGER NOT NULL,
    "tipo_repasse" "TipoRepasse" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "operadora_cartao_taxas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bancos_codigo_compe_key" ON "bancos"("codigo_compe");

-- CreateIndex
CREATE UNIQUE INDEX "bancos_ispb_key" ON "bancos"("ispb");

-- CreateIndex
CREATE INDEX "bancos_nome_idx" ON "bancos"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "bandeiras_nome_key" ON "bandeiras"("nome");

-- CreateIndex
CREATE INDEX "operadoras_cartao_empresa_id_idx" ON "operadoras_cartao"("empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "operadora_cartao_taxas_operadora_id_bandeira_id_modalidade_key" ON "operadora_cartao_taxas"("operadora_id", "bandeira_id", "modalidade");

-- AddForeignKey
ALTER TABLE "operadoras_cartao" ADD CONSTRAINT "operadoras_cartao_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operadora_cartao_taxas" ADD CONSTRAINT "operadora_cartao_taxas_operadora_id_fkey" FOREIGN KEY ("operadora_id") REFERENCES "operadoras_cartao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operadora_cartao_taxas" ADD CONSTRAINT "operadora_cartao_taxas_bandeira_id_fkey" FOREIGN KEY ("bandeira_id") REFERENCES "bandeiras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contas_financeiras" ADD CONSTRAINT "contas_financeiras_banco_id_fkey" FOREIGN KEY ("banco_id") REFERENCES "bancos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
