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
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cn } from "@/lib/utils";
import { Dialog, DialogPortal, DialogOverlay, DialogTrigger, DialogClose } from "@/components/ui/dialog";
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

      <Dialog>
        <DialogTrigger
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
        </DialogTrigger>

        <DialogPortal>
          <DialogOverlay />
          <DialogPrimitive.Popup className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[80vh] w-full max-w-[400px] flex-col rounded-t-2xl bg-card pb-[calc(env(safe-area-inset-bottom)+12px)] shadow-lg outline-none duration-150 data-open:animate-in data-open:slide-in-from-bottom data-closed:animate-out data-closed:slide-out-to-bottom">
            <div className="flex justify-center pt-2.5 pb-1">
              <span className="h-1 w-9 rounded-full bg-border" />
            </div>
            <div className="grid grid-cols-2 gap-2.5 overflow-y-auto px-[18px] pt-3 pb-4">
              <DialogClose
                render={<Link href="/fornecedores" />}
                className="flex items-center gap-2.5 rounded-2xl bg-muted p-3.5 text-left active:bg-accent"
              >
                <Truck className="size-[18px] flex-none text-primary" />
                <span className="text-[13.5px] font-medium">Fornecedores</span>
              </DialogClose>
              <DialogClose
                render={<Link href="/clientes" />}
                className="flex items-center gap-2.5 rounded-2xl bg-muted p-3.5 text-left active:bg-accent"
              >
                <Users className="size-[18px] flex-none text-primary" />
                <span className="text-[13.5px] font-medium">Clientes</span>
              </DialogClose>
              <DialogClose
                render={<Link href="/depositos" />}
                className="flex items-center gap-2.5 rounded-2xl bg-muted p-3.5 text-left active:bg-accent"
              >
                <Warehouse className="size-[18px] flex-none text-primary" />
                <span className="text-[13.5px] font-medium">Depósitos</span>
              </DialogClose>
              <DialogClose
                render={<Link href="/categorias" />}
                className="flex items-center gap-2.5 rounded-2xl bg-muted p-3.5 text-left active:bg-accent"
              >
                <Tags className="size-[18px] flex-none text-primary" />
                <span className="text-[13.5px] font-medium">Categorias</span>
              </DialogClose>
              <DialogClose
                render={<Link href="/unidades-medida" />}
                className="flex items-center gap-2.5 rounded-2xl bg-muted p-3.5 text-left active:bg-accent"
              >
                <Ruler className="size-[18px] flex-none text-primary" />
                <span className="text-[13.5px] font-medium">Unidades de Medida</span>
              </DialogClose>
              {isAdmin && (
                <DialogClose
                  render={<Link href="/usuarios" />}
                  className="flex items-center gap-2.5 rounded-2xl bg-muted p-3.5 text-left active:bg-accent"
                >
                  <UserCog className="size-[18px] flex-none text-primary" />
                  <span className="text-[13.5px] font-medium">Usuários</span>
                </DialogClose>
              )}
              <DialogClose
                onClick={() => signOutAction()}
                className="flex items-center gap-2.5 rounded-2xl bg-muted p-3.5 text-left text-destructive active:bg-destructive/10"
              >
                <LogOut className="size-[18px] flex-none" />
                <span className="text-[13.5px] font-medium">Sair</span>
              </DialogClose>
            </div>
          </DialogPrimitive.Popup>
        </DialogPortal>
      </Dialog>
    </div>
  );
}
