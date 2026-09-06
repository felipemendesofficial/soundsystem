import Link from "next/link";
import { ChevronRight, Plus, ClipboardList, Package, Truck, Users, Warehouse, UserCog } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeVerCusto, podeGerenciarUsuarios } from "@/lib/permissions";
import { cn } from "@/lib/utils";

export default async function HomePage() {
  const session = await auth();
  const perfil = session!.user.perfil;

  const totalProdutos = await db.produto.count({ where: { ativo: true } });

  let valorTotalEstoque: string | null = null;
  if (podeVerCusto(perfil)) {
    const agregado = await db.produtoEstoque.aggregate({
      _sum: { valorTotalSaldo: true },
    });
    valorTotalEstoque = Number(agregado._sum.valorTotalSaldo ?? 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  const stats = [
    { label: "Produtos ativos", value: String(totalProdutos), dot: "bg-brand-green" },
    ...(valorTotalEstoque !== null
      ? [{ label: "Valor total em estoque", value: valorTotalEstoque, dot: "bg-primary", warn: true }]
      : []),
  ];

  const atalhos = [
    {
      href: "/movimentacoes/nova",
      titulo: "Nova Movimentação",
      descricao: "Registrar entrada ou saída",
      icon: Plus,
      primary: true,
    },
    {
      href: "/estoque",
      titulo: "Posição de Estoque",
      descricao: "Saldo e valor por produto",
      icon: ClipboardList,
    },
    {
      href: "/produtos",
      titulo: "Produtos",
      descricao: "Cadastro e ficha Kardex",
      icon: Package,
    },
  ];

  const cadastros = [
    { href: "/fornecedores", titulo: "Fornecedores", icon: Truck },
    { href: "/clientes", titulo: "Clientes", icon: Users },
    { href: "/depositos", titulo: "Depósitos", icon: Warehouse },
    ...(podeGerenciarUsuarios(perfil) ? [{ href: "/usuarios", titulo: "Usuários", icon: UserCog }] : []),
  ];

  return (
    <div>
      <div>
        <h1 className="font-heading text-[30px] font-extrabold uppercase leading-tight">
          Olá, {session!.user.name}
        </h1>
        <p className="mt-0.5 text-[13.5px] text-muted-foreground">Visão geral do estoque</p>
      </div>

      <div className="-mx-[18px] mt-[18px] flex gap-2.5 overflow-x-auto px-[18px] pb-1 [scrollbar-width:none]">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="relative w-fit min-w-[140px] flex-none rounded-[14px] border border-border bg-card p-3.5 pb-4"
          >
            <div className={cn("absolute right-2.5 top-2.5 size-2 rounded-full", stat.dot)} />
            <div className="mb-2.5 font-mono text-[9.5px] uppercase tracking-[0.08em] text-text-faint">
              {stat.label}
            </div>
            <div
              className={cn(
                "font-heading text-[32px] font-extrabold leading-none whitespace-nowrap",
                stat.warn && "text-primary"
              )}
            >
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      <div className="pb-2.5 pt-[22px] font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
        Ações rápidas
      </div>
      <div className="flex flex-col gap-2.5">
        {atalhos.map((atalho) => (
          <Link
            key={atalho.href}
            href={atalho.href}
            className="flex items-center gap-3.5 rounded-[14px] border border-border bg-card p-3.5 active:bg-accent"
          >
            <div
              className={cn(
                "flex size-[42px] flex-none items-center justify-center rounded-[10px] bg-accent text-primary",
                atalho.primary && "bg-brand-yellow text-brand-yellow-foreground"
              )}
            >
              <atalho.icon className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[14.5px] font-bold">{atalho.titulo}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{atalho.descricao}</div>
            </div>
            <ChevronRight className="size-4 flex-none text-text-faint" />
          </Link>
        ))}
      </div>

      <div className="pb-2.5 pt-[22px] font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
        Cadastros
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {cadastros.map((cadastro) => (
          <Link
            key={cadastro.href}
            href={cadastro.href}
            className="flex flex-col gap-2.5 rounded-[14px] border border-border bg-card p-3.5 active:bg-accent"
          >
            <div className="flex size-[34px] items-center justify-center rounded-[9px] bg-accent text-primary">
              <cadastro.icon className="size-[17px]" />
            </div>
            <div className="text-[13.5px] font-bold">{cadastro.titulo}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
