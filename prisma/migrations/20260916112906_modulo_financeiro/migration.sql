-- CreateEnum
CREATE TYPE "TipoLancamentoFinanceiro" AS ENUM ('receita', 'despesa');

-- CreateEnum
CREATE TYPE "NaturezaConta" AS ENUM ('sintetica', 'analitica');

-- CreateEnum
CREATE TYPE "NaturezaLancamento" AS ENUM ('real', 'prevista');

-- CreateEnum
CREATE TYPE "StatusLancamentoFinanceiro" AS ENUM ('aberto', 'baixado', 'estornado', 'cancelado');

-- CreateEnum
CREATE TYPE "TipoConta" AS ENUM ('conta_corrente', 'caixa', 'fundo_fixo', 'aplicacao');

-- CreateEnum
CREATE TYPE "TipoDocumento" AS ENUM ('especie', 'cheque_vista', 'cheque_prazo', 'cheque_devolvido', 'deposito_cartorio', 'nota_promissoria', 'deposito_bancario', 'pix', 'cartao');

-- CreateEnum
CREATE TYPE "TipoTaxaCartao" AS ENUM ('a_vista', 'antecipacao', 'parc_estabelecimento', 'parc_cliente');

-- CreateEnum
CREATE TYPE "StatusRetencao" AS ENUM ('pendente', 'recolhida');

-- CreateEnum
CREATE TYPE "StatusComissao" AS ENUM ('pendente', 'paga');

-- CreateEnum
CREATE TYPE "TipoMovimentacaoFinanceira" AS ENUM ('baixa_receita', 'baixa_despesa', 'estorno_baixa', 'transferencia_entrada', 'transferencia_saida', 'aplicacao_financeira', 'resgate_aplicacao', 'rendimento_aplicacao', 'estorno_movimento_aplicacao');

-- CreateEnum
CREATE TYPE "TipoMovimentoAplicacao" AS ENUM ('aplicacao_financeira', 'resgate_aplicacao', 'registro_rendimento');

-- CreateEnum
CREATE TYPE "TipoMovimentoTransferencia" AS ENUM ('transferencia_geral', 'reposicao_fundo_fixo', 'saldo_caixa_banco', 'emprestimo_contraido_banco', 'transferencia_entre_caixas', 'transferencia_banco_para_caixa');

-- CreateEnum
CREATE TYPE "StatusConciliacao" AS ENUM ('pendente', 'conciliado');

-- CreateEnum
CREATE TYPE "OrigemPendencia" AS ENUM ('manual', 'importacao_extrato');

-- CreateEnum
CREATE TYPE "TipoPendencia" AS ENUM ('entrada', 'saida');

-- CreateTable
CREATE TABLE "fechamentos_diarios" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "fechado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechado_por_id" TEXT NOT NULL,
    "reaberto_em" TIMESTAMP(3),
    "reaberto_por_id" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "fechamentos_diarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portadores" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "portadores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alineas_devolucao_cheque" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "alineas_devolucao_cheque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contas_financeiras" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "tipo" "TipoConta" NOT NULL,
    "nome" TEXT NOT NULL,
    "numero_conta" TEXT,
    "agencia" TEXT,
    "banco" TEXT,
    "limite_credito" DECIMAL(14,2),
    "data_abertura" TIMESTAMP(3),
    "valor_fundo_fixo" DECIMAL(14,2),
    "saldo_inicial" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "saldo_atual" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "gerar_boleto" BOOLEAN NOT NULL DEFAULT false,
    "adiantamento_cliente" BOOLEAN NOT NULL DEFAULT false,
    "adiantamento_fornecedor" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contas_financeiras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parametros_financeiros" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "plano_aplicacao_id" TEXT,
    "plano_resgate_id" TEXT,
    "plano_rendimento_id" TEXT,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parametros_financeiros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mascaras_plano_financeiro" (
    "id" TEXT NOT NULL,
    "grupo_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "mascaras_plano_financeiro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mascara_segmentos" (
    "id" TEXT NOT NULL,
    "mascara_id" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "qtd_digitos" INTEGER NOT NULL,
    "nome" TEXT,

    CONSTRAINT "mascara_segmentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planos_financeiros" (
    "id" TEXT NOT NULL,
    "grupo_id" TEXT NOT NULL,
    "mascara_id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "tipo" "TipoLancamentoFinanceiro" NOT NULL,
    "natureza" "NaturezaConta" NOT NULL,
    "nivel" INTEGER NOT NULL,
    "pai_id" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "planos_financeiros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mascaras_centro_custo" (
    "id" TEXT NOT NULL,
    "grupo_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "mascaras_centro_custo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mascara_centro_custo_segmentos" (
    "id" TEXT NOT NULL,
    "mascara_id" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "qtd_digitos" INTEGER NOT NULL,
    "nome" TEXT,

    CONSTRAINT "mascara_centro_custo_segmentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "centros_custo" (
    "id" TEXT NOT NULL,
    "grupo_id" TEXT NOT NULL,
    "mascara_id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "natureza" "NaturezaConta" NOT NULL,
    "nivel" INTEGER NOT NULL,
    "pai_id" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "centros_custo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mascaras_processo" (
    "id" TEXT NOT NULL,
    "grupo_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,

    CONSTRAINT "mascaras_processo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mascara_processo_segmentos" (
    "id" TEXT NOT NULL,
    "mascara_id" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "qtd_digitos" INTEGER NOT NULL,
    "nome" TEXT,

    CONSTRAINT "mascara_processo_segmentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processos" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "mascara_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "data_inicio" TIMESTAMP(3) NOT NULL,
    "data_fim" TIMESTAMP(3) NOT NULL,
    "padrao" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processo_itens" (
    "id" TEXT NOT NULL,
    "processo_id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "natureza" "NaturezaConta" NOT NULL,
    "nivel" INTEGER NOT NULL,
    "pai_id" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "processo_itens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lancamentos_financeiros" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "tipo" "TipoLancamentoFinanceiro" NOT NULL,
    "status" "StatusLancamentoFinanceiro" NOT NULL DEFAULT 'aberto',
    "natureza" "NaturezaLancamento" NOT NULL,
    "convertido_em" TIMESTAMP(3),
    "historico_simplificado" TEXT NOT NULL,
    "historico_complementar" TEXT,
    "documento" TEXT,
    "documento_fisico" BOOLEAN NOT NULL DEFAULT false,
    "tipoDocumento" "TipoDocumento" NOT NULL,
    "portador_id" TEXT,
    "conta_prevista_id" TEXT,
    "cliente_id" TEXT,
    "fornecedor_id" TEXT,
    "valor_original" DECIMAL(14,2) NOT NULL,
    "data_emissao" TIMESTAMP(3) NOT NULL,
    "data_vencimento" TIMESTAMP(3) NOT NULL,
    "data_movimento" TIMESTAMP(3) NOT NULL,
    "mora_mes" DECIMAL(5,2),
    "processo_id" TEXT NOT NULL,
    "observacao" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lancamentos_financeiros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lancamento_rateios" (
    "id" TEXT NOT NULL,
    "lancamento_id" TEXT NOT NULL,
    "plano_id" TEXT NOT NULL,
    "percentual" DECIMAL(5,2) NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "lancamento_rateios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lancamento_rateio_centro_custo" (
    "id" TEXT NOT NULL,
    "lancamento_rateio_id" TEXT NOT NULL,
    "centro_custo_id" TEXT NOT NULL,
    "percentual" DECIMAL(5,2) NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "lancamento_rateio_centro_custo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lancamento_rateio_processo" (
    "id" TEXT NOT NULL,
    "lancamento_id" TEXT NOT NULL,
    "processo_item_id" TEXT NOT NULL,
    "percentual" DECIMAL(5,2) NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "lancamento_rateio_processo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retencoes" (
    "id" TEXT NOT NULL,
    "lancamento_id" TEXT NOT NULL,
    "plano_id" TEXT NOT NULL,
    "percentual" DECIMAL(5,2) NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "status" "StatusRetencao" NOT NULL DEFAULT 'pendente',
    "recolhimento_id" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "retencoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comissoes" (
    "id" TEXT NOT NULL,
    "lancamento_id" TEXT NOT NULL,
    "vendedor_id" TEXT NOT NULL,
    "percentual" DECIMAL(5,2) NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "status" "StatusComissao" NOT NULL DEFAULT 'pendente',
    "pagamento_id" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comissoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dados_cheque" (
    "id" TEXT NOT NULL,
    "lancamento_id" TEXT NOT NULL,
    "banco" TEXT,
    "agencia" TEXT,
    "numero_cheque" TEXT,
    "conta_corrente" TEXT,
    "cgc" TEXT,
    "cpf" TEXT,
    "telefone" TEXT,
    "terceiro_cliente_id" TEXT,
    "terceiro_fornecedor_id" TEXT,

    CONSTRAINT "dados_cheque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dados_cartao" (
    "id" TEXT NOT NULL,
    "lancamento_id" TEXT NOT NULL,
    "operadora" TEXT,
    "numero_cartao" TEXT,
    "lote_rv" TEXT,
    "numero_autorizacao" TEXT,
    "tipo_taxa" "TipoTaxaCartao",

    CONSTRAINT "dados_cartao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "baixas" (
    "id" TEXT NOT NULL,
    "lancamento_id" TEXT NOT NULL,
    "conta_id" TEXT NOT NULL,
    "valor_baixado" DECIMAL(14,2) NOT NULL,
    "data_baixa" TIMESTAMP(3) NOT NULL,
    "juros" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "multa" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "desconto" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "historico_complementar" TEXT,
    "alinea_devolucao_id" TEXT,
    "estornada" BOOLEAN NOT NULL DEFAULT false,
    "movimentacao_id" TEXT NOT NULL,

    CONSTRAINT "baixas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cheques_terceiro_utilizados" (
    "id" TEXT NOT NULL,
    "baixa_despesa_id" TEXT NOT NULL,
    "baixa_cheque_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cheques_terceiro_utilizados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estornos_financeiros" (
    "id" TEXT NOT NULL,
    "baixa_id" TEXT NOT NULL,
    "conta_id" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "data_estorno" TIMESTAMP(3) NOT NULL,
    "alinea_devolucao_id" TEXT,
    "movimentacao_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estornos_financeiros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transferencias_entre_contas" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "tipo_movimento" "TipoMovimentoTransferencia" NOT NULL DEFAULT 'transferencia_geral',
    "conta_origem_id" TEXT NOT NULL,
    "conta_destino_id" TEXT NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "historico" TEXT,
    "data" TIMESTAMP(3) NOT NULL,
    "estornada" BOOLEAN NOT NULL DEFAULT false,
    "cliente_id" TEXT,
    "fornecedor_id" TEXT,
    "mov_saida_id" TEXT NOT NULL,
    "mov_entrada_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transferencias_entre_contas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimentos_aplicacao" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "tipo_movimento" "TipoMovimentoAplicacao" NOT NULL,
    "da_conta_id" TEXT,
    "para_conta_id" TEXT NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "data_movimento" TIMESTAMP(3) NOT NULL,
    "estornado" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimentos_aplicacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimentacoes_financeiras" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "conta_id" TEXT NOT NULL,
    "conta_destino_id" TEXT,
    "tipo" "TipoMovimentacaoFinanceira" NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "saldo_anterior" DECIMAL(14,2) NOT NULL,
    "saldo_posterior" DECIMAL(14,2) NOT NULL,
    "lancamento_id" TEXT,
    "movimento_aplicacao_id" TEXT,
    "plano_id" TEXT,
    "cliente_id" TEXT,
    "fornecedor_id" TEXT,
    "documento" TEXT,
    "descricao" TEXT NOT NULL,
    "status_conciliacao" "StatusConciliacao" NOT NULL DEFAULT 'pendente',
    "conciliado_em" TIMESTAMP(3),
    "extrato_bancario_id" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimentacoes_financeiras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saldos_mensais_conta" (
    "id" TEXT NOT NULL,
    "conta_id" TEXT NOT NULL,
    "competencia" TIMESTAMP(3) NOT NULL,
    "saldo_inicial" DECIMAL(14,2) NOT NULL,
    "saldo_final" DECIMAL(14,2) NOT NULL,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saldos_mensais_conta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saldos_adiantamento_terceiro" (
    "id" TEXT NOT NULL,
    "conta_id" TEXT NOT NULL,
    "cliente_id" TEXT,
    "fornecedor_id" TEXT,
    "saldo_atual" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saldos_adiantamento_terceiro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extrato_bancario_linhas" (
    "id" TEXT NOT NULL,
    "conta_id" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "origem" "OrigemPendencia" NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "extrato_bancario_linhas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pendencias_conciliacao" (
    "id" TEXT NOT NULL,
    "conta_id" TEXT NOT NULL,
    "tipo" "TipoPendencia" NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "comentario" TEXT,
    "origem" "OrigemPendencia" NOT NULL,
    "resolvido_em" TIMESTAMP(3),
    "lancamento_id" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pendencias_conciliacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fechamentos_diarios_empresa_id_ativo_data_idx" ON "fechamentos_diarios"("empresa_id", "ativo", "data");

-- CreateIndex
CREATE UNIQUE INDEX "fechamentos_diarios_empresa_id_data_key" ON "fechamentos_diarios"("empresa_id", "data");

-- CreateIndex
CREATE INDEX "portadores_empresa_id_idx" ON "portadores"("empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "alineas_devolucao_cheque_codigo_key" ON "alineas_devolucao_cheque"("codigo");

-- CreateIndex
CREATE INDEX "contas_financeiras_empresa_id_tipo_idx" ON "contas_financeiras"("empresa_id", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "parametros_financeiros_empresa_id_key" ON "parametros_financeiros"("empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "mascaras_plano_financeiro_grupo_id_nome_key" ON "mascaras_plano_financeiro"("grupo_id", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "mascara_segmentos_mascara_id_ordem_key" ON "mascara_segmentos"("mascara_id", "ordem");

-- CreateIndex
CREATE INDEX "planos_financeiros_pai_id_idx" ON "planos_financeiros"("pai_id");

-- CreateIndex
CREATE UNIQUE INDEX "planos_financeiros_grupo_id_codigo_key" ON "planos_financeiros"("grupo_id", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "mascaras_centro_custo_grupo_id_nome_key" ON "mascaras_centro_custo"("grupo_id", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "mascara_centro_custo_segmentos_mascara_id_ordem_key" ON "mascara_centro_custo_segmentos"("mascara_id", "ordem");

-- CreateIndex
CREATE INDEX "centros_custo_pai_id_idx" ON "centros_custo"("pai_id");

-- CreateIndex
CREATE UNIQUE INDEX "centros_custo_grupo_id_codigo_key" ON "centros_custo"("grupo_id", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "mascaras_processo_grupo_id_nome_key" ON "mascaras_processo"("grupo_id", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "mascara_processo_segmentos_mascara_id_ordem_key" ON "mascara_processo_segmentos"("mascara_id", "ordem");

-- CreateIndex
CREATE INDEX "processos_empresa_id_idx" ON "processos"("empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "processo_itens_processo_id_codigo_key" ON "processo_itens"("processo_id", "codigo");

-- CreateIndex
CREATE INDEX "lancamentos_financeiros_empresa_id_status_idx" ON "lancamentos_financeiros"("empresa_id", "status");

-- CreateIndex
CREATE INDEX "lancamentos_financeiros_empresa_id_tipo_natureza_idx" ON "lancamentos_financeiros"("empresa_id", "tipo", "natureza");

-- CreateIndex
CREATE INDEX "lancamentos_financeiros_processo_id_idx" ON "lancamentos_financeiros"("processo_id");

-- CreateIndex
CREATE UNIQUE INDEX "lancamento_rateios_lancamento_id_plano_id_key" ON "lancamento_rateios"("lancamento_id", "plano_id");

-- CreateIndex
CREATE UNIQUE INDEX "lancamento_rateio_centro_custo_lancamento_rateio_id_centro__key" ON "lancamento_rateio_centro_custo"("lancamento_rateio_id", "centro_custo_id");

-- CreateIndex
CREATE UNIQUE INDEX "lancamento_rateio_processo_lancamento_id_processo_item_id_key" ON "lancamento_rateio_processo"("lancamento_id", "processo_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "dados_cheque_lancamento_id_key" ON "dados_cheque"("lancamento_id");

-- CreateIndex
CREATE UNIQUE INDEX "dados_cartao_lancamento_id_key" ON "dados_cartao"("lancamento_id");

-- CreateIndex
CREATE UNIQUE INDEX "baixas_lancamento_id_key" ON "baixas"("lancamento_id");

-- CreateIndex
CREATE UNIQUE INDEX "baixas_movimentacao_id_key" ON "baixas"("movimentacao_id");

-- CreateIndex
CREATE INDEX "baixas_conta_id_data_baixa_idx" ON "baixas"("conta_id", "data_baixa");

-- CreateIndex
CREATE UNIQUE INDEX "cheques_terceiro_utilizados_baixa_cheque_id_key" ON "cheques_terceiro_utilizados"("baixa_cheque_id");

-- CreateIndex
CREATE UNIQUE INDEX "estornos_financeiros_baixa_id_key" ON "estornos_financeiros"("baixa_id");

-- CreateIndex
CREATE UNIQUE INDEX "estornos_financeiros_movimentacao_id_key" ON "estornos_financeiros"("movimentacao_id");

-- CreateIndex
CREATE UNIQUE INDEX "transferencias_entre_contas_mov_saida_id_key" ON "transferencias_entre_contas"("mov_saida_id");

-- CreateIndex
CREATE UNIQUE INDEX "transferencias_entre_contas_mov_entrada_id_key" ON "transferencias_entre_contas"("mov_entrada_id");

-- CreateIndex
CREATE INDEX "movimentacoes_financeiras_empresa_id_conta_id_criado_em_idx" ON "movimentacoes_financeiras"("empresa_id", "conta_id", "criado_em");

-- CreateIndex
CREATE INDEX "movimentacoes_financeiras_conta_id_status_conciliacao_idx" ON "movimentacoes_financeiras"("conta_id", "status_conciliacao");

-- CreateIndex
CREATE UNIQUE INDEX "saldos_mensais_conta_conta_id_competencia_key" ON "saldos_mensais_conta"("conta_id", "competencia");

-- CreateIndex
CREATE UNIQUE INDEX "saldos_adiantamento_terceiro_conta_id_cliente_id_key" ON "saldos_adiantamento_terceiro"("conta_id", "cliente_id");

-- CreateIndex
CREATE UNIQUE INDEX "saldos_adiantamento_terceiro_conta_id_fornecedor_id_key" ON "saldos_adiantamento_terceiro"("conta_id", "fornecedor_id");

-- AddForeignKey
ALTER TABLE "fechamentos_diarios" ADD CONSTRAINT "fechamentos_diarios_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contas_financeiras" ADD CONSTRAINT "contas_financeiras_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parametros_financeiros" ADD CONSTRAINT "parametros_financeiros_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parametros_financeiros" ADD CONSTRAINT "parametros_financeiros_plano_aplicacao_id_fkey" FOREIGN KEY ("plano_aplicacao_id") REFERENCES "planos_financeiros"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parametros_financeiros" ADD CONSTRAINT "parametros_financeiros_plano_resgate_id_fkey" FOREIGN KEY ("plano_resgate_id") REFERENCES "planos_financeiros"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parametros_financeiros" ADD CONSTRAINT "parametros_financeiros_plano_rendimento_id_fkey" FOREIGN KEY ("plano_rendimento_id") REFERENCES "planos_financeiros"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mascaras_plano_financeiro" ADD CONSTRAINT "mascaras_plano_financeiro_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupos_empresariais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mascara_segmentos" ADD CONSTRAINT "mascara_segmentos_mascara_id_fkey" FOREIGN KEY ("mascara_id") REFERENCES "mascaras_plano_financeiro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planos_financeiros" ADD CONSTRAINT "planos_financeiros_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupos_empresariais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planos_financeiros" ADD CONSTRAINT "planos_financeiros_mascara_id_fkey" FOREIGN KEY ("mascara_id") REFERENCES "mascaras_plano_financeiro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planos_financeiros" ADD CONSTRAINT "planos_financeiros_pai_id_fkey" FOREIGN KEY ("pai_id") REFERENCES "planos_financeiros"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mascaras_centro_custo" ADD CONSTRAINT "mascaras_centro_custo_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupos_empresariais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mascara_centro_custo_segmentos" ADD CONSTRAINT "mascara_centro_custo_segmentos_mascara_id_fkey" FOREIGN KEY ("mascara_id") REFERENCES "mascaras_centro_custo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "centros_custo" ADD CONSTRAINT "centros_custo_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupos_empresariais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "centros_custo" ADD CONSTRAINT "centros_custo_mascara_id_fkey" FOREIGN KEY ("mascara_id") REFERENCES "mascaras_centro_custo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "centros_custo" ADD CONSTRAINT "centros_custo_pai_id_fkey" FOREIGN KEY ("pai_id") REFERENCES "centros_custo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mascaras_processo" ADD CONSTRAINT "mascaras_processo_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupos_empresariais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mascara_processo_segmentos" ADD CONSTRAINT "mascara_processo_segmentos_mascara_id_fkey" FOREIGN KEY ("mascara_id") REFERENCES "mascaras_processo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processos" ADD CONSTRAINT "processos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processos" ADD CONSTRAINT "processos_mascara_id_fkey" FOREIGN KEY ("mascara_id") REFERENCES "mascaras_processo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processo_itens" ADD CONSTRAINT "processo_itens_processo_id_fkey" FOREIGN KEY ("processo_id") REFERENCES "processos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processo_itens" ADD CONSTRAINT "processo_itens_pai_id_fkey" FOREIGN KEY ("pai_id") REFERENCES "processo_itens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos_financeiros" ADD CONSTRAINT "lancamentos_financeiros_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos_financeiros" ADD CONSTRAINT "lancamentos_financeiros_portador_id_fkey" FOREIGN KEY ("portador_id") REFERENCES "portadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos_financeiros" ADD CONSTRAINT "lancamentos_financeiros_conta_prevista_id_fkey" FOREIGN KEY ("conta_prevista_id") REFERENCES "contas_financeiras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos_financeiros" ADD CONSTRAINT "lancamentos_financeiros_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos_financeiros" ADD CONSTRAINT "lancamentos_financeiros_fornecedor_id_fkey" FOREIGN KEY ("fornecedor_id") REFERENCES "fornecedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos_financeiros" ADD CONSTRAINT "lancamentos_financeiros_processo_id_fkey" FOREIGN KEY ("processo_id") REFERENCES "processos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamento_rateios" ADD CONSTRAINT "lancamento_rateios_lancamento_id_fkey" FOREIGN KEY ("lancamento_id") REFERENCES "lancamentos_financeiros"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamento_rateios" ADD CONSTRAINT "lancamento_rateios_plano_id_fkey" FOREIGN KEY ("plano_id") REFERENCES "planos_financeiros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamento_rateio_centro_custo" ADD CONSTRAINT "lancamento_rateio_centro_custo_lancamento_rateio_id_fkey" FOREIGN KEY ("lancamento_rateio_id") REFERENCES "lancamento_rateios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamento_rateio_centro_custo" ADD CONSTRAINT "lancamento_rateio_centro_custo_centro_custo_id_fkey" FOREIGN KEY ("centro_custo_id") REFERENCES "centros_custo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamento_rateio_processo" ADD CONSTRAINT "lancamento_rateio_processo_lancamento_id_fkey" FOREIGN KEY ("lancamento_id") REFERENCES "lancamentos_financeiros"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamento_rateio_processo" ADD CONSTRAINT "lancamento_rateio_processo_processo_item_id_fkey" FOREIGN KEY ("processo_item_id") REFERENCES "processo_itens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retencoes" ADD CONSTRAINT "retencoes_lancamento_id_fkey" FOREIGN KEY ("lancamento_id") REFERENCES "lancamentos_financeiros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retencoes" ADD CONSTRAINT "retencoes_plano_id_fkey" FOREIGN KEY ("plano_id") REFERENCES "planos_financeiros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retencoes" ADD CONSTRAINT "retencoes_recolhimento_id_fkey" FOREIGN KEY ("recolhimento_id") REFERENCES "lancamentos_financeiros"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comissoes" ADD CONSTRAINT "comissoes_lancamento_id_fkey" FOREIGN KEY ("lancamento_id") REFERENCES "lancamentos_financeiros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comissoes" ADD CONSTRAINT "comissoes_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "vendedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comissoes" ADD CONSTRAINT "comissoes_pagamento_id_fkey" FOREIGN KEY ("pagamento_id") REFERENCES "lancamentos_financeiros"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dados_cheque" ADD CONSTRAINT "dados_cheque_lancamento_id_fkey" FOREIGN KEY ("lancamento_id") REFERENCES "lancamentos_financeiros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dados_cheque" ADD CONSTRAINT "dados_cheque_terceiro_cliente_id_fkey" FOREIGN KEY ("terceiro_cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dados_cheque" ADD CONSTRAINT "dados_cheque_terceiro_fornecedor_id_fkey" FOREIGN KEY ("terceiro_fornecedor_id") REFERENCES "fornecedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dados_cartao" ADD CONSTRAINT "dados_cartao_lancamento_id_fkey" FOREIGN KEY ("lancamento_id") REFERENCES "lancamentos_financeiros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "baixas" ADD CONSTRAINT "baixas_lancamento_id_fkey" FOREIGN KEY ("lancamento_id") REFERENCES "lancamentos_financeiros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "baixas" ADD CONSTRAINT "baixas_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "contas_financeiras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "baixas" ADD CONSTRAINT "baixas_alinea_devolucao_id_fkey" FOREIGN KEY ("alinea_devolucao_id") REFERENCES "alineas_devolucao_cheque"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "baixas" ADD CONSTRAINT "baixas_movimentacao_id_fkey" FOREIGN KEY ("movimentacao_id") REFERENCES "movimentacoes_financeiras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cheques_terceiro_utilizados" ADD CONSTRAINT "cheques_terceiro_utilizados_baixa_despesa_id_fkey" FOREIGN KEY ("baixa_despesa_id") REFERENCES "baixas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cheques_terceiro_utilizados" ADD CONSTRAINT "cheques_terceiro_utilizados_baixa_cheque_id_fkey" FOREIGN KEY ("baixa_cheque_id") REFERENCES "baixas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estornos_financeiros" ADD CONSTRAINT "estornos_financeiros_baixa_id_fkey" FOREIGN KEY ("baixa_id") REFERENCES "baixas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estornos_financeiros" ADD CONSTRAINT "estornos_financeiros_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "contas_financeiras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estornos_financeiros" ADD CONSTRAINT "estornos_financeiros_alinea_devolucao_id_fkey" FOREIGN KEY ("alinea_devolucao_id") REFERENCES "alineas_devolucao_cheque"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estornos_financeiros" ADD CONSTRAINT "estornos_financeiros_movimentacao_id_fkey" FOREIGN KEY ("movimentacao_id") REFERENCES "movimentacoes_financeiras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transferencias_entre_contas" ADD CONSTRAINT "transferencias_entre_contas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transferencias_entre_contas" ADD CONSTRAINT "transferencias_entre_contas_conta_origem_id_fkey" FOREIGN KEY ("conta_origem_id") REFERENCES "contas_financeiras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transferencias_entre_contas" ADD CONSTRAINT "transferencias_entre_contas_conta_destino_id_fkey" FOREIGN KEY ("conta_destino_id") REFERENCES "contas_financeiras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transferencias_entre_contas" ADD CONSTRAINT "transferencias_entre_contas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transferencias_entre_contas" ADD CONSTRAINT "transferencias_entre_contas_fornecedor_id_fkey" FOREIGN KEY ("fornecedor_id") REFERENCES "fornecedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transferencias_entre_contas" ADD CONSTRAINT "transferencias_entre_contas_mov_saida_id_fkey" FOREIGN KEY ("mov_saida_id") REFERENCES "movimentacoes_financeiras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transferencias_entre_contas" ADD CONSTRAINT "transferencias_entre_contas_mov_entrada_id_fkey" FOREIGN KEY ("mov_entrada_id") REFERENCES "movimentacoes_financeiras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentos_aplicacao" ADD CONSTRAINT "movimentos_aplicacao_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentos_aplicacao" ADD CONSTRAINT "movimentos_aplicacao_da_conta_id_fkey" FOREIGN KEY ("da_conta_id") REFERENCES "contas_financeiras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentos_aplicacao" ADD CONSTRAINT "movimentos_aplicacao_para_conta_id_fkey" FOREIGN KEY ("para_conta_id") REFERENCES "contas_financeiras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes_financeiras" ADD CONSTRAINT "movimentacoes_financeiras_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes_financeiras" ADD CONSTRAINT "movimentacoes_financeiras_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "contas_financeiras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes_financeiras" ADD CONSTRAINT "movimentacoes_financeiras_conta_destino_id_fkey" FOREIGN KEY ("conta_destino_id") REFERENCES "contas_financeiras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes_financeiras" ADD CONSTRAINT "movimentacoes_financeiras_lancamento_id_fkey" FOREIGN KEY ("lancamento_id") REFERENCES "lancamentos_financeiros"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes_financeiras" ADD CONSTRAINT "movimentacoes_financeiras_movimento_aplicacao_id_fkey" FOREIGN KEY ("movimento_aplicacao_id") REFERENCES "movimentos_aplicacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes_financeiras" ADD CONSTRAINT "movimentacoes_financeiras_plano_id_fkey" FOREIGN KEY ("plano_id") REFERENCES "planos_financeiros"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes_financeiras" ADD CONSTRAINT "movimentacoes_financeiras_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes_financeiras" ADD CONSTRAINT "movimentacoes_financeiras_fornecedor_id_fkey" FOREIGN KEY ("fornecedor_id") REFERENCES "fornecedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes_financeiras" ADD CONSTRAINT "movimentacoes_financeiras_extrato_bancario_id_fkey" FOREIGN KEY ("extrato_bancario_id") REFERENCES "extrato_bancario_linhas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saldos_mensais_conta" ADD CONSTRAINT "saldos_mensais_conta_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "contas_financeiras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saldos_adiantamento_terceiro" ADD CONSTRAINT "saldos_adiantamento_terceiro_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "contas_financeiras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saldos_adiantamento_terceiro" ADD CONSTRAINT "saldos_adiantamento_terceiro_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saldos_adiantamento_terceiro" ADD CONSTRAINT "saldos_adiantamento_terceiro_fornecedor_id_fkey" FOREIGN KEY ("fornecedor_id") REFERENCES "fornecedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extrato_bancario_linhas" ADD CONSTRAINT "extrato_bancario_linhas_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "contas_financeiras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pendencias_conciliacao" ADD CONSTRAINT "pendencias_conciliacao_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "contas_financeiras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
