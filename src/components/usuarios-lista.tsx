"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export type ItemUsuario = {
  id: string;
  nome: string;
  email: string;
  perfil: string;
  depositoPadrao: string;
  ativo: boolean;
  buscaTexto: string;
};

export function UsuariosLista({ itens }: { itens: ItemUsuario[] }) {
  const [busca, setBusca] = useState("");

  const termo = busca.trim().toLowerCase();
  const filtrados = termo ? itens.filter((i) => i.buscaTexto.includes(termo)) : itens;

  return (
    <div className="space-y-2">
      <Input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por nome ou email"
        aria-label="Buscar usuário"
      />

      {filtrados.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          {termo ? `Nenhum usuário encontrado para "${busca.trim()}".` : "Nenhum usuário cadastrado."}
        </p>
      ) : (
        <ul className="space-y-2">
          {filtrados.map((item) => (
            <li key={item.id}>
              <Link
                href={`/usuarios/${item.id}`}
                className="relative block rounded-lg border border-border bg-card p-3 active:bg-accent"
              >
                <Badge variant={item.ativo ? "default" : "secondary"} className="absolute top-3 right-3">
                  {item.ativo ? "Ativo" : "Inativo"}
                </Badge>
                <h2 className="mb-2 text-[15px] font-semibold">{item.nome}</h2>

                <div className="grid grid-cols-3 gap-x-2 gap-y-1.5">
                  <div className="min-w-0">
                    <div className="truncate text-[11px] leading-tight text-muted-foreground">Email</div>
                    <div className="truncate text-[14px] leading-tight font-medium">{item.email}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[11px] leading-tight text-muted-foreground">Perfil</div>
                    <div className="truncate text-[14px] leading-tight font-medium">{item.perfil}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[11px] leading-tight text-muted-foreground">Depósito</div>
                    <div className="truncate text-[14px] leading-tight font-medium">{item.depositoPadrao}</div>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
