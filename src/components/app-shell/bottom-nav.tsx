"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Package,
  Plus,
  ClipboardList,
  MoreHorizontal,
  Truck,
  Users,
  Warehouse,
  UserCog,
  Tags,
  Ruler,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOutAction } from "@/lib/actions/auth-actions";

const NAV_ITEMS = [
  { href: "/", label: "Início", icon: Home },
  { href: "/produtos", label: "Produtos", icon: Package },
  { href: "/movimentacoes/nova", label: "Movimentar", icon: Plus },
  { href: "/estoque", label: "Estoque", icon: ClipboardList },
];

const MAIS_ROUTES = ["/fornecedores", "/clientes", "/depositos", "/categorias", "/unidades-medida", "/usuarios"];

function NavLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: typeof Home;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-1 flex-col items-center gap-[3px] font-mono text-[10px] tracking-[0.02em] text-text-faint",
        active && "text-foreground"
      )}
    >
      <Icon className={cn("size-5", active && "text-primary")} />
      {label}
    </Link>
  );
}

export function BottomNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const mais = isAdmin ? [...MAIS_ROUTES, "/usuarios"] : MAIS_ROUTES;
  const maisAtivo = mais.some((rota) => pathname.startsWith(rota));

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 mx-auto flex w-full max-w-[400px] justify-between border-t border-border bg-card px-1 pt-2 pb-2.5">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.href}
          href={item.href}
          label={item.label}
          icon={item.icon}
          active={item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)}
        />
      ))}

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className={cn(
                "flex flex-1 flex-col items-center gap-[3px] font-mono text-[10px] tracking-[0.02em] text-text-faint",
                maisAtivo && "text-foreground"
              )}
            />
          }
        >
          <MoreHorizontal className={cn("size-5", maisAtivo && "text-primary")} />
          Mais
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" sideOffset={8}>
          <DropdownMenuItem render={<Link href="/fornecedores" />}>
            <Truck />
            Fornecedores
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/clientes" />}>
            <Users />
            Clientes
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/depositos" />}>
            <Warehouse />
            Depósitos
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/categorias" />}>
            <Tags />
            Categorias
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/unidades-medida" />}>
            <Ruler />
            Unidades de Medida
          </DropdownMenuItem>
          {isAdmin && (
            <DropdownMenuItem render={<Link href="/usuarios" />}>
              <UserCog />
              Usuários
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => signOutAction()}>
            <LogOut />
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
