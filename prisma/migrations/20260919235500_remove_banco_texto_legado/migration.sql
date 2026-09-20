-- Remove o campo legado de texto livre "banco" da ContaFinanceira, agora
-- substituido por bancoId (FK pro catalogo Banco) apos backfill via
-- prisma/scripts/backfill-conta-financeira-banco.ts.
ALTER TABLE "contas_financeiras" DROP COLUMN "banco";
