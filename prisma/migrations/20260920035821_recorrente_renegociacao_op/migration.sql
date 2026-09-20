-- CreateEnum
CREATE TYPE "Periodicidade" AS ENUM ('mensal', 'bimestral', 'trimestral', 'semestral', 'anual');

-- CreateEnum
CREATE TYPE "StatusOrdemProducao" AS ENUM ('aberta', 'processada');

-- AlterTable
ALTER TABLE "lancamentos_financeiros" ADD COLUMN     "recorrente_id" TEXT;

-- CreateTable
CREATE TABLE "lancamentos_financeiros_recorrentes" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "tipo" "TipoLancamentoFinanceiro" NOT NULL,
    "descricao" TEXT NOT NULL,
    "fornecedor_id" TEXT,
    "cliente_id" TEXT,
    "tipo_documento" "TipoDocumento" NOT NULL,
    "conta_prevista_id" TEXT,
    "processo_id" TEXT NOT NULL,
    "natureza" "NaturezaLancamento" NOT NULL,
    "periodicidade" "Periodicidade" NOT NULL,
    "dia_vencimento" INTEGER NOT NULL,
    "data_inicio" TIMESTAMP(3) NOT NULL,
    "data_fim" TIMESTAMP(3),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lancamentos_financeiros_recorrentes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lancamentos_financeiros_recorrentes_rateio_plano" (
    "id" TEXT NOT NULL,
    "recorrente_id" TEXT NOT NULL,
    "plano_id" TEXT NOT NULL,
    "percentual" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "lancamentos_financeiros_recorrentes_rateio_plano_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lancamentos_financeiros_recorrentes_rateio_centro_custo" (
    "id" TEXT NOT NULL,
    "rateio_plano_id" TEXT NOT NULL,
    "centro_custo_id" TEXT NOT NULL,
    "percentual" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "lancamentos_financeiros_recorrentes_rateio_centro_custo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lancamentos_financeiros_recorrentes_rateio_processo" (
    "id" TEXT NOT NULL,
    "recorrente_id" TEXT NOT NULL,
    "processo_item_id" TEXT NOT NULL,
    "percentual" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "lancamentos_financeiros_recorrentes_rateio_processo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "renegociacoes" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "tipo" "TipoLancamentoFinanceiro" NOT NULL,
    "motivo" TEXT NOT NULL,
    "criado_por_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "renegociacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "renegociacoes_origens" (
    "id" TEXT NOT NULL,
    "renegociacao_id" TEXT NOT NULL,
    "lancamento_id" TEXT NOT NULL,

    CONSTRAINT "renegociacoes_origens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "renegociacoes_destinos" (
    "id" TEXT NOT NULL,
    "renegociacao_id" TEXT NOT NULL,
    "lancamento_id" TEXT NOT NULL,
    "juros" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "multa" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "desconto" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "justificativa_desconto" TEXT,

    CONSTRAINT "renegociacoes_destinos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordens_producao" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "deposito_entrada_id" TEXT NOT NULL,
    "produto_final_id" TEXT NOT NULL,
    "quantidade_entrada" DECIMAL(14,3) NOT NULL,
    "custo_unitario_final" DECIMAL(14,4),
    "status" "StatusOrdemProducao" NOT NULL DEFAULT 'aberta',
    "usuario_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processado_em" TIMESTAMP(3),

    CONSTRAINT "ordens_producao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordens_producao_materiais" (
    "id" TEXT NOT NULL,
    "ordem_producao_id" TEXT NOT NULL,
    "produto_id" TEXT NOT NULL,
    "deposito_id" TEXT NOT NULL,
    "quantidade" DECIMAL(14,3) NOT NULL,
    "custo_unitario_debitado" DECIMAL(14,4),

    CONSTRAINT "ordens_producao_materiais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordens_producao_servicos" (
    "id" TEXT NOT NULL,
    "ordem_producao_id" TEXT NOT NULL,
    "servico_id" TEXT NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "ordens_producao_servicos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lancamentos_financeiros_recorrentes_empresa_id_ativo_idx" ON "lancamentos_financeiros_recorrentes"("empresa_id", "ativo");

-- CreateIndex
CREATE UNIQUE INDEX "lancamentos_financeiros_recorrentes_rateio_plano_recorrente_key" ON "lancamentos_financeiros_recorrentes_rateio_plano"("recorrente_id", "plano_id");

-- CreateIndex
CREATE UNIQUE INDEX "lancamentos_financeiros_recorrentes_rateio_centro_custo_rat_key" ON "lancamentos_financeiros_recorrentes_rateio_centro_custo"("rateio_plano_id", "centro_custo_id");

-- CreateIndex
CREATE UNIQUE INDEX "lancamentos_financeiros_recorrentes_rateio_processo_recorre_key" ON "lancamentos_financeiros_recorrentes_rateio_processo"("recorrente_id", "processo_item_id");

-- CreateIndex
CREATE INDEX "renegociacoes_empresa_id_idx" ON "renegociacoes"("empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "renegociacoes_origens_lancamento_id_key" ON "renegociacoes_origens"("lancamento_id");

-- CreateIndex
CREATE UNIQUE INDEX "renegociacoes_destinos_lancamento_id_key" ON "renegociacoes_destinos"("lancamento_id");

-- CreateIndex
CREATE INDEX "ordens_producao_empresa_id_status_idx" ON "ordens_producao"("empresa_id", "status");

-- CreateIndex
CREATE INDEX "lancamentos_financeiros_recorrente_id_idx" ON "lancamentos_financeiros"("recorrente_id");

-- AddForeignKey
ALTER TABLE "lancamentos_financeiros" ADD CONSTRAINT "lancamentos_financeiros_recorrente_id_fkey" FOREIGN KEY ("recorrente_id") REFERENCES "lancamentos_financeiros_recorrentes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos_financeiros_recorrentes" ADD CONSTRAINT "lancamentos_financeiros_recorrentes_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos_financeiros_recorrentes" ADD CONSTRAINT "lancamentos_financeiros_recorrentes_fornecedor_id_fkey" FOREIGN KEY ("fornecedor_id") REFERENCES "fornecedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos_financeiros_recorrentes" ADD CONSTRAINT "lancamentos_financeiros_recorrentes_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos_financeiros_recorrentes" ADD CONSTRAINT "lancamentos_financeiros_recorrentes_conta_prevista_id_fkey" FOREIGN KEY ("conta_prevista_id") REFERENCES "contas_financeiras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos_financeiros_recorrentes" ADD CONSTRAINT "lancamentos_financeiros_recorrentes_processo_id_fkey" FOREIGN KEY ("processo_id") REFERENCES "processos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos_financeiros_recorrentes_rateio_plano" ADD CONSTRAINT "lancamentos_financeiros_recorrentes_rateio_plano_recorrent_fkey" FOREIGN KEY ("recorrente_id") REFERENCES "lancamentos_financeiros_recorrentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos_financeiros_recorrentes_rateio_plano" ADD CONSTRAINT "lancamentos_financeiros_recorrentes_rateio_plano_plano_id_fkey" FOREIGN KEY ("plano_id") REFERENCES "planos_financeiros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos_financeiros_recorrentes_rateio_centro_custo" ADD CONSTRAINT "lancamentos_financeiros_recorrentes_rateio_centro_custo_ra_fkey" FOREIGN KEY ("rateio_plano_id") REFERENCES "lancamentos_financeiros_recorrentes_rateio_plano"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos_financeiros_recorrentes_rateio_centro_custo" ADD CONSTRAINT "lancamentos_financeiros_recorrentes_rateio_centro_custo_ce_fkey" FOREIGN KEY ("centro_custo_id") REFERENCES "centros_custo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos_financeiros_recorrentes_rateio_processo" ADD CONSTRAINT "lancamentos_financeiros_recorrentes_rateio_processo_recorr_fkey" FOREIGN KEY ("recorrente_id") REFERENCES "lancamentos_financeiros_recorrentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos_financeiros_recorrentes_rateio_processo" ADD CONSTRAINT "lancamentos_financeiros_recorrentes_rateio_processo_proces_fkey" FOREIGN KEY ("processo_item_id") REFERENCES "processo_itens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renegociacoes" ADD CONSTRAINT "renegociacoes_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renegociacoes" ADD CONSTRAINT "renegociacoes_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renegociacoes_origens" ADD CONSTRAINT "renegociacoes_origens_renegociacao_id_fkey" FOREIGN KEY ("renegociacao_id") REFERENCES "renegociacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renegociacoes_origens" ADD CONSTRAINT "renegociacoes_origens_lancamento_id_fkey" FOREIGN KEY ("lancamento_id") REFERENCES "lancamentos_financeiros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renegociacoes_destinos" ADD CONSTRAINT "renegociacoes_destinos_renegociacao_id_fkey" FOREIGN KEY ("renegociacao_id") REFERENCES "renegociacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renegociacoes_destinos" ADD CONSTRAINT "renegociacoes_destinos_lancamento_id_fkey" FOREIGN KEY ("lancamento_id") REFERENCES "lancamentos_financeiros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordens_producao" ADD CONSTRAINT "ordens_producao_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordens_producao" ADD CONSTRAINT "ordens_producao_deposito_entrada_id_fkey" FOREIGN KEY ("deposito_entrada_id") REFERENCES "depositos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordens_producao" ADD CONSTRAINT "ordens_producao_produto_final_id_fkey" FOREIGN KEY ("produto_final_id") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordens_producao" ADD CONSTRAINT "ordens_producao_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordens_producao_materiais" ADD CONSTRAINT "ordens_producao_materiais_ordem_producao_id_fkey" FOREIGN KEY ("ordem_producao_id") REFERENCES "ordens_producao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordens_producao_materiais" ADD CONSTRAINT "ordens_producao_materiais_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordens_producao_materiais" ADD CONSTRAINT "ordens_producao_materiais_deposito_id_fkey" FOREIGN KEY ("deposito_id") REFERENCES "depositos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordens_producao_servicos" ADD CONSTRAINT "ordens_producao_servicos_ordem_producao_id_fkey" FOREIGN KEY ("ordem_producao_id") REFERENCES "ordens_producao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordens_producao_servicos" ADD CONSTRAINT "ordens_producao_servicos_servico_id_fkey" FOREIGN KEY ("servico_id") REFERENCES "servicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
