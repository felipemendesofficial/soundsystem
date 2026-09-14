"use client";

import Link from "next/link";
import { Boxes, LogOut, Building2 } from "lucide-react";
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

export function TopBar({
  name,
  perfil,
  grupoNome,
  empresaNome,
}: {
  name: string;
  perfil: string;
  grupoNome: string;
  empresaNome: string;
}) {
  return (
    <div className="bg-shell px-[18px] pt-4 pb-3.5 text-shell-foreground">
      <div className="flex items-start justify-between">
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="mt-0.5 flex size-[26px] shrink-0 items-center justify-center rounded-[5px] border-2 border-brand-yellow">
            <Boxes className="size-3.5 text-brand-yellow" />
          </div>
          <div className="min-w-0 font-mono text-[11px] leading-[1.6] tracking-[0.14em] text-white/70 uppercase">
            <div className="truncate">{grupoNome}</div>
            <div className="truncate">{empresaNome}</div>
            <div className="truncate">{name}</div>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-yellow font-mono text-[13px] font-bold text-brand-yellow-foreground"
              />
            }
          >
            {getInitials(name)}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8}>
            <DropdownMenuLabel>
              <div className="font-medium text-foreground">{name}</div>
              <div className="text-xs text-muted-foreground capitalize">{perfil} · {empresaNome}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/selecionar-empresa" />}>
              <Building2 />
              Trocar empresa
            </DropdownMenuItem>
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
