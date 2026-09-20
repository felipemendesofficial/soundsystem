-- Adiciona data_previsao como NULLABLE, faz o backfill a partir de
-- data_vencimento (única suposição segura sem inventar uma data diferente)
-- e só então marca NOT NULL — evita o bloqueio interativo do Prisma ao
-- adicionar coluna obrigatória numa tabela com linhas existentes.
ALTER TABLE "lancamentos_financeiros" ADD COLUMN "data_previsao" TIMESTAMP(3);

UPDATE "lancamentos_financeiros" SET "data_previsao" = "data_vencimento" WHERE "data_previsao" IS NULL;

ALTER TABLE "lancamentos_financeiros" ALTER COLUMN "data_previsao" SET NOT NULL;
