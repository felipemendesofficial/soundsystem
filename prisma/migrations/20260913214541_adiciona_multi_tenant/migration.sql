-- Migração 1/2 do retrofit multi-tenant (Grupo Empresarial > Empresa).
-- Só aditiva: cria tabelas novas e colunas novas, todas NULLABLE por enquanto.
-- Nenhum comportamento muda ainda — código antigo continua funcionando sem
-- tocar nas colunas novas. O backfill + aperto de constraints (NOT NULL,
-- troca de unique global por unique-por-grupo, CHECK, índices) fica na
-- migração seguinte (20260913214601_backfill_multi_tenant).

-- === Novo valor de enum ==================================================
-- Precisa estar numa migração própria, já commitada, ANTES de qualquer
-- statement que use o valor 'master' (a migração de backfill usa em WHEREs
-- e num CHECK) — Postgres não permite usar um valor de enum recém-criado
-- na mesma transação em que foi adicionado.
ALTER TYPE "Perfil" ADD VALUE 'master';

-- === Tabelas novas ========================================================
CREATE TABLE "grupos_empresariais" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grupos_empresariais_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "empresas" (
    "id" TEXT NOT NULL,
    "grupo_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cnpj" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "empresas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "usuario_empresas" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "deposito_padrao_id" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_empresas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "usuario_empresas_usuario_id_empresa_id_key" ON "usuario_empresas"("usuario_id", "empresa_id");

ALTER TABLE "empresas" ADD CONSTRAINT "empresas_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupos_empresariais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "usuario_empresas" ADD CONSTRAINT "usuario_empresas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "usuario_empresas" ADD CONSTRAINT "usuario_empresas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "usuario_empresas" ADD CONSTRAINT "usuario_empresas_deposito_padrao_id_fkey" FOREIGN KEY ("deposito_padrao_id") REFERENCES "depositos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- === Deposito -> Empresa (nullable por enquanto) =========================
ALTER TABLE "depositos" ADD COLUMN "empresa_id" TEXT;
ALTER TABLE "depositos" ADD CONSTRAINT "depositos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- === Cadastros compartilhados por Grupo (nullable por enquanto) ==========
ALTER TABLE "categorias" ADD COLUMN "grupo_id" TEXT;
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupos_empresariais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "unidades_medida" ADD COLUMN "grupo_id" TEXT;
ALTER TABLE "unidades_medida" ADD CONSTRAINT "unidades_medida_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupos_empresariais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tabelas_preco" ADD COLUMN "grupo_id" TEXT;
ALTER TABLE "tabelas_preco" ADD CONSTRAINT "tabelas_preco_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupos_empresariais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "servicos" ADD COLUMN "grupo_id" TEXT;
ALTER TABLE "servicos" ADD CONSTRAINT "servicos_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupos_empresariais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "produtos" ADD COLUMN "grupo_id" TEXT;
ALTER TABLE "produtos" ADD CONSTRAINT "produtos_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupos_empresariais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "fornecedores" ADD COLUMN "grupo_id" TEXT;
ALTER TABLE "fornecedores" ADD CONSTRAINT "fornecedores_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupos_empresariais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "clientes" ADD COLUMN "grupo_id" TEXT;
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupos_empresariais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vendedores" ADD COLUMN "grupo_id" TEXT;
ALTER TABLE "vendedores" ADD CONSTRAINT "vendedores_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupos_empresariais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- === Usuario -> Grupo (fica NULLABLE para sempre — master é NULL) ========
ALTER TABLE "usuarios" ADD COLUMN "grupo_id" TEXT;
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupos_empresariais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- usuarios.deposito_padrao_id NÃO é removido aqui: a migração de backfill
-- ainda precisa ler esse valor pra popular usuario_empresas.deposito_padrao_id
-- antes de descartar a coluna antiga.

-- === ProdutoEstoque: só empresa_id (sem grupo_id — sem rollup entre empresas do saldo) ===
ALTER TABLE "produto_estoque" ADD COLUMN "empresa_id" TEXT;
ALTER TABLE "produto_estoque" ADD CONSTRAINT "produto_estoque_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- === Transacionais: empresa_id + grupo_id denormalizados (nullable por enquanto) ===
ALTER TABLE "movimentacoes" ADD COLUMN "empresa_id" TEXT;
ALTER TABLE "movimentacoes" ADD COLUMN "grupo_id" TEXT;
ALTER TABLE "movimentacoes" ADD CONSTRAINT "movimentacoes_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "movimentacoes" ADD CONSTRAINT "movimentacoes_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupos_empresariais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ordens_servico" ADD COLUMN "empresa_id" TEXT;
ALTER TABLE "ordens_servico" ADD COLUMN "grupo_id" TEXT;
ALTER TABLE "ordens_servico" ADD CONSTRAINT "ordens_servico_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ordens_servico" ADD CONSTRAINT "ordens_servico_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupos_empresariais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "orcamentos" ADD COLUMN "empresa_id" TEXT;
ALTER TABLE "orcamentos" ADD COLUMN "grupo_id" TEXT;
ALTER TABLE "orcamentos" ADD CONSTRAINT "orcamentos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "orcamentos" ADD CONSTRAINT "orcamentos_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupos_empresariais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "lancamentos" ADD COLUMN "empresa_id" TEXT;
ALTER TABLE "lancamentos" ADD COLUMN "grupo_id" TEXT;
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupos_empresariais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
