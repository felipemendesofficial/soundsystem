-- Impede o mesmo produto de ser lançado duas vezes no mesmo Orçamento de
-- Compra: um produto duplicado quebra o congelamento de custo em
-- finalizarOrcamento (o `.find()` por produtoId só acha a primeira linha) e
-- deixa a linha duplicada sem estorno em cancelarFechamentoOrcamento,
-- vazando estoque a cada ciclo fechar/reabrir.
CREATE UNIQUE INDEX "orcamento_itens_orcamento_id_produto_id_key" ON "orcamento_itens"("orcamento_id", "produto_id");
