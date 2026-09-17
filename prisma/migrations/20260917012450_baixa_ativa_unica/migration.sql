-- Garante só 1 Baixa ativa (não estornada) por Lançamento Financeiro.
-- `baixas.lancamento_id` deixou de ser @unique na migration anterior (agora
-- um lançamento pode acumular várias baixas ao longo do tempo, uma estornada
-- e outra criada depois) — mas continua só podendo ter UMA "corrente" por
-- vez. Índice parcial não é representável em @@unique/@@index do Prisma
-- 7.10 instalado, por isso SQL cru (mesmo padrão já usado em
-- processos_empresa_id_padrao_unico).
CREATE UNIQUE INDEX "baixas_lancamento_id_ativa_unico" ON "baixas"("lancamento_id") WHERE "estornada" = false;
