"use client";

import { Boxes, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOutAction } from "@/lib/actions/auth-actions";

function getInitials(name: string) {
  const partes = name.trim().split(/\s+/);
  const iniciais = partes.length > 1 ? [partes[0], partes[partes.length - 1]] : [partes[0]];
  return iniciais.map((p) => p[0]).join("").toUpperCase().slice(0, 2);
}

export function TopBar({ name, perfil }: { name: string; perfil: string }) {
  return (
    <div className="bg-shell px-[18px] pt-4 pb-3.5 text-shell-foreground">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex size-[26px] items-center justify-center rounded-[5px] border-2 border-brand-yellow">
            <Boxes className="size-3.5 text-brand-yellow" />
          </div>
          <div className="font-mono text-[11px] tracking-[0.14em] text-white/70 uppercase">
            Controle de Estoque
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className="flex size-8 items-center justify-center rounded-full bg-brand-yellow font-mono text-[13px] font-bold text-brand-yellow-foreground"
              />
            }
          >
            {getInitials(name)}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8}>
            <DropdownMenuLabel>
              <div className="font-medium text-foreground">{name}</div>
              <div className="text-xs text-muted-foreground capitalize">{perfil}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => signOutAction()}>
              <LogOut />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
