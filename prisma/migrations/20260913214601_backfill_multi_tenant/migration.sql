-- Migração 2/2 do retrofit multi-tenant (Grupo Empresarial > Empresa).
-- Cria um Grupo + Empresa padrão, migra TODO dado hoje existente pra eles,
-- e só então aperta as colunas pra NOT NULL e troca a unicidade global
-- pela unicidade por grupo. Sem BEGIN/COMMIT explícitos — o Prisma já roda
-- este arquivo inteiro dentro da própria transação.

-- 1) Grupo + Empresa padrão, materializados numa temp table pra reutilizar
--    os IDs em todos os UPDATEs seguintes (CTEs de INSERT...RETURNING só
--    valem dentro do próprio statement).
CREATE TEMP TABLE _default_tenant AS
WITH novo_grupo AS (
  INSERT INTO "grupos_empresariais" ("id", "nome", "ativo", "criado_em")
  VALUES (gen_random_uuid(), 'Grupo Padrão', true, now())
  RETURNING "id"
),
nova_empresa AS (
  INSERT INTO "empresas" ("id", "grupo_id", "nome", "ativo", "criado_em")
  SELECT gen_random_uuid(), "id", 'Empresa Padrão', true, now()
  FROM novo_grupo
  RETURNING "id" AS empresa_id, "grupo_id"
)
SELECT empresa_id, grupo_id FROM nova_empresa;

-- 2) Backfill dos cadastros compartilhados (grupo_id)
UPDATE "produtos" SET "grupo_id" = (SELECT grupo_id FROM _default_tenant) WHERE "grupo_id" IS NULL;
UPDATE "categorias" SET "grupo_id" = (SELECT grupo_id FROM _default_tenant) WHERE "grupo_id" IS NULL;
UPDATE "unidades_medida" SET "grupo_id" = (SELECT grupo_id FROM _default_tenant) WHERE "grupo_id" IS NULL;
UPDATE "tabelas_preco" SET "grupo_id" = (SELECT grupo_id FROM _default_tenant) WHERE "grupo_id" IS NULL;
UPDATE "servicos" SET "grupo_id" = (SELECT grupo_id FROM _default_tenant) WHERE "grupo_id" IS NULL;
UPDATE "fornecedores" SET "grupo_id" = (SELECT grupo_id FROM _default_tenant) WHERE "grupo_id" IS NULL;
UPDATE "clientes" SET "grupo_id" = (SELECT grupo_id FROM _default_tenant) WHERE "grupo_id" IS NULL;
UPDATE "vendedores" SET "grupo_id" = (SELECT grupo_id FROM _default_tenant) WHERE "grupo_id" IS NULL;

-- 3) Backfill de Depositos (empresa_id) — tem que rodar antes do passo 4,
--    que faz JOIN em depositos.empresa_id
UPDATE "depositos" SET "empresa_id" = (SELECT empresa_id FROM _default_tenant) WHERE "empresa_id" IS NULL;

-- 4) Backfill das transacionais (empresa_id [+ grupo_id] via join com depositos)
UPDATE "produto_estoque" pe SET "empresa_id" = d."empresa_id"
FROM "depositos" d WHERE pe."deposito_id" = d."id" AND pe."empresa_id" IS NULL;

UPDATE "movimentacoes" m SET "empresa_id" = d."empresa_id", "grupo_id" = d2.grupo_id
FROM "depositos" d, (SELECT grupo_id FROM _default_tenant) d2
WHERE m."deposito_id" = d."id" AND m."empresa_id" IS NULL;

UPDATE "ordens_servico" os SET "empresa_id" = d."empresa_id", "grupo_id" = d2.grupo_id
FROM "depositos" d, (SELECT grupo_id FROM _default_tenant) d2
WHERE os."deposito_id" = d."id" AND os."empresa_id" IS NULL;

UPDATE "orcamentos" o SET "empresa_id" = d."empresa_id", "grupo_id" = d2.grupo_id
FROM "depositos" d, (SELECT grupo_id FROM _default_tenant) d2
WHERE o."deposito_id" = d."id" AND o."empresa_id" IS NULL;

-- Lancamento usa deposito_id (compra/venda/etc.) OU deposito_origem_id
-- (só transferência) — nunca só o segundo, senão a maioria dos lançamentos
-- fica sem empresa_id/grupo_id.
UPDATE "lancamentos" l SET "empresa_id" = d."empresa_id", "grupo_id" = d2.grupo_id
FROM "depositos" d, (SELECT grupo_id FROM _default_tenant) d2
WHERE d."id" = COALESCE(l."deposito_id", l."deposito_origem_id") AND l."empresa_id" IS NULL;

-- 5) Usuario.grupo_id + vínculo em usuario_empresas (todo usuário existente
--    hoje é não-master, então todos ganham grupo_id e acesso à empresa padrão)
UPDATE "usuarios" SET "grupo_id" = (SELECT grupo_id FROM _default_tenant) WHERE "grupo_id" IS NULL AND "perfil" != 'master';

INSERT INTO "usuario_empresas" ("id", "usuario_id", "empresa_id", "deposito_padrao_id", "criado_em")
SELECT gen_random_uuid(), u."id", (SELECT empresa_id FROM _default_tenant), u."deposito_padrao_id", now()
FROM "usuarios" u WHERE u."perfil" != 'master';

-- Só agora, com o valor já migrado pra usuario_empresas, a coluna antiga sai.
ALTER TABLE "usuarios" DROP CONSTRAINT "usuarios_deposito_padrao_id_fkey";
ALTER TABLE "usuarios" DROP COLUMN "deposito_padrao_id";

-- 6) NOT NULL nas colunas backfilladas
ALTER TABLE "produtos" ALTER COLUMN "grupo_id" SET NOT NULL;
ALTER TABLE "categorias" ALTER COLUMN "grupo_id" SET NOT NULL;
ALTER TABLE "unidades_medida" ALTER COLUMN "grupo_id" SET NOT NULL;
ALTER TABLE "tabelas_preco" ALTER COLUMN "grupo_id" SET NOT NULL;
ALTER TABLE "servicos" ALTER COLUMN "grupo_id" SET NOT NULL;
ALTER TABLE "fornecedores" ALTER COLUMN "grupo_id" SET NOT NULL;
ALTER TABLE "clientes" ALTER COLUMN "grupo_id" SET NOT NULL;
ALTER TABLE "vendedores" ALTER COLUMN "grupo_id" SET NOT NULL;
ALTER TABLE "depositos" ALTER COLUMN "empresa_id" SET NOT NULL;
ALTER TABLE "produto_estoque" ALTER COLUMN "empresa_id" SET NOT NULL;
ALTER TABLE "movimentacoes" ALTER COLUMN "empresa_id" SET NOT NULL, ALTER COLUMN "grupo_id" SET NOT NULL;
ALTER TABLE "ordens_servico" ALTER COLUMN "empresa_id" SET NOT NULL, ALTER COLUMN "grupo_id" SET NOT NULL;
ALTER TABLE "orcamentos" ALTER COLUMN "empresa_id" SET NOT NULL, ALTER COLUMN "grupo_id" SET NOT NULL;
ALTER TABLE "lancamentos" ALTER COLUMN "empresa_id" SET NOT NULL, ALTER COLUMN "grupo_id" SET NOT NULL;
-- usuarios.grupo_id fica NULLABLE (master precisa ser NULL) — não altera

-- 7) Unicidade global -> unicidade por grupo
DROP INDEX "produtos_sku_key";
CREATE UNIQUE INDEX "produtos_grupo_id_sku_key" ON "produtos"("grupo_id", "sku");

DROP INDEX "categorias_nome_key";
CREATE UNIQUE INDEX "categorias_grupo_id_nome_key" ON "categorias"("grupo_id", "nome");

DROP INDEX "unidades_medida_nome_key";
CREATE UNIQUE INDEX "unidades_medida_grupo_id_nome_key" ON "unidades_medida"("grupo_id", "nome");

DROP INDEX "tabelas_preco_nome_key";
CREATE UNIQUE INDEX "tabelas_preco_grupo_id_nome_key" ON "tabelas_preco"("grupo_id", "nome");

DROP INDEX "servicos_nome_key";
CREATE UNIQUE INDEX "servicos_grupo_id_nome_key" ON "servicos"("grupo_id", "nome");

-- 8) Invariante estrutural: master <-> grupo_id nulo (não representável no
--    schema.prisma — @@check não é suportado nesta versão do Prisma)
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_master_sem_grupo_check"
  CHECK (("perfil" = 'master' AND "grupo_id" IS NULL) OR ("perfil" != 'master' AND "grupo_id" IS NOT NULL));

-- 9) Índices de relatório — na coluna de data de NEGÓCIO real de cada
--    tabela (data_movimento em movimentacoes, não criado_em, que é só o
--    timestamp de inserção da linha; criada_em em ordens_servico, não
--    criado_em, que não existe nessa tabela).
CREATE INDEX "movimentacoes_empresa_id_data_movimento_idx" ON "movimentacoes"("empresa_id", "data_movimento");
CREATE INDEX "ordens_servico_empresa_id_criada_em_idx" ON "ordens_servico"("empresa_id", "criada_em");
CREATE INDEX "orcamentos_empresa_id_criado_em_idx" ON "orcamentos"("empresa_id", "criado_em");
CREATE INDEX "lancamentos_empresa_id_criado_em_idx" ON "lancamentos"("empresa_id", "criado_em");

DROP TABLE _default_tenant;
