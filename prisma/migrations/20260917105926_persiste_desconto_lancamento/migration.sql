-- Mesmo tratamento já dado à Ordem de Serviço (migration
-- 20260917025348_persiste_desconto_os): desconto/acréscimo de um Lançamento
-- de venda agora persiste a configuração no cabeçalho e o preço-base
-- original por item, em vez de só sobrescrever precoVenda e perder o dado.
-- Reusa os enums ModoAjuste/FormatoAjuste já criados naquela migration.
ALTER TABLE "lancamentos"
  ADD COLUMN "modo_ajuste" "ModoAjuste" NOT NULL DEFAULT 'nenhum',
  ADD COLUMN "formato_ajuste" "FormatoAjuste" NOT NULL DEFAULT 'percentual',
  ADD COLUMN "valor_ajuste" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- preco_original fica NULL nos itens sem preço de venda (compra/transferência
-- /outras saídas) — mesma nulidade de preco_venda. Backfill só copia onde já
-- havia preco_venda: não há como saber se aquele valor já tinha desconto
-- embutido, então assume-se que não (mesmo raciocínio da migration da OS).
ALTER TABLE "lancamento_itens" ADD COLUMN "preco_original" DECIMAL(14,2);
UPDATE "lancamento_itens" SET "preco_original" = "preco_venda" WHERE "preco_venda" IS NOT NULL;
