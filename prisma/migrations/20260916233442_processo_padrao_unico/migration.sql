-- Garante só 1 Processo com padrao=true por empresa. O comentário original em
-- schema.prisma (model Processo) já prometia essa restrição via índice único
-- parcial, mas ela nunca foi de fato criada na migration
-- 20260916112906_modulo_financeiro — corrigido aqui. Índice parcial não é
-- representável em @@unique/@@index do Prisma 7.10 instalado, por isso SQL cru
-- (mesmo padrão já usado pro CHECK constraint de usuarios_master_sem_grupo).
CREATE UNIQUE INDEX "processos_empresa_id_padrao_unico" ON "processos"("empresa_id") WHERE "padrao" = true;
