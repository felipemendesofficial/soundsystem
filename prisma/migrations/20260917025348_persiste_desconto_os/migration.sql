-- ModoAjuste/FormatoAjuste + campos de desconto no cabeçalho da OS: antes
-- disso a configuração de desconto/acréscimo vivia só no estado do
-- formulário e era descartada no submit — reabrir uma OS pra editar não
-- tinha como saber que desconto tinha sido aplicado.
CREATE TYPE "ModoAjuste" AS ENUM ('nenhum', 'desconto', 'acrescimo');
CREATE TYPE "FormatoAjuste" AS ENUM ('percentual', 'valor');

ALTER TABLE "ordens_servico"
  ADD COLUMN "modo_ajuste" "ModoAjuste" NOT NULL DEFAULT 'nenhum',
  ADD COLUMN "formato_ajuste" "FormatoAjuste" NOT NULL DEFAULT 'percentual',
  ADD COLUMN "valor_ajuste" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- preco_original: preço-base de cada item, nunca tocado pelo desconto.
-- preco_unitario continua sendo o preço líquido (o que vai pro Kardex na
-- conclusão da OS). Sem preco_original, o preço-base se perdia assim que um
-- desconto era salvo, e reaplicar um novo desconto numa edição composto em
-- cima do preço já descontado em vez de recalcular do zero.
ALTER TABLE "os_itens_produto" ADD COLUMN "preco_original" DECIMAL(14,2);
UPDATE "os_itens_produto" SET "preco_original" = "preco_unitario";
ALTER TABLE "os_itens_produto" ALTER COLUMN "preco_original" SET NOT NULL;

ALTER TABLE "os_itens_servico" ADD COLUMN "preco_original" DECIMAL(14,2);
UPDATE "os_itens_servico" SET "preco_original" = "preco_unitario";
ALTER TABLE "os_itens_servico" ALTER COLUMN "preco_original" SET NOT NULL;
