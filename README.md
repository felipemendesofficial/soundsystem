# Controle de Estoque — Kardex / Média Ponderada

Sistema de controle de entrada e saída de mercadorias com custo médio ponderado móvel, ficha Kardex por item, multi-depósito e multiusuário. Stack: Next.js (App Router) + TypeScript + Prisma + PostgreSQL + Auth.js.

## Pré-requisitos

- Node.js 20+
- Docker (para rodar o Postgres local)

## Configuração inicial

```bash
# 1. Instalar dependências (se ainda não instalado)
npm install

# 2. Subir o Postgres local
docker compose up -d

# 3. Aplicar o schema no banco
npx prisma migrate dev --name init

# 4. Popular com usuários de teste e um depósito padrão
npm run db:seed

# 5. Rodar o projeto
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

## Usuários de teste (criados pelo seed)

| Perfil     | Email                  | Senha       | Observação                              |
|------------|-------------------------|-------------|------------------------------------------|
| admin      | admin@exemplo.com       | admin123    | Acesso total, gerencia usuários          |
| estoquista | estoquista@exemplo.com  | estoque123  | Vê custo/margem, lança qualquer movimento|
| vendedor   | vendedor@exemplo.com    | venda123    | Só registra vendas, não vê custo/margem  |

**Troque essas senhas antes de qualquer uso real.**

## Estrutura

- `prisma/schema.prisma` — modelo de dados (depósitos, usuários, produtos, fornecedores, clientes, estoque, movimentações)
- `src/lib/kardex.ts` — núcleo do sistema: cálculo do custo médio ponderado móvel, transacional e com trava de linha para concorrência
- `src/lib/permissions.ts` — regras de quem vê custo/margem e quem gerencia usuários
- `src/app/(app)/*` — telas autenticadas (produtos, fornecedores, clientes, depósitos, usuários, movimentações, kardex, posição de estoque)
- `src/app/login` — autenticação

## Comandos úteis

```bash
npx prisma studio       # navegador visual do banco
npx prisma migrate dev  # criar/aplicar novas migrações após mudar o schema
npm run db:seed         # repopular dados de teste
```

## Fora do escopo do MVP (Fase 1)

Emissão de nota fiscal, integrações externas, relatório de margem/giro de estoque/entradas por fornecedor — previstos para uma fase futura.
