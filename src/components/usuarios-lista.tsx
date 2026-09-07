"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
    <div className="space-y-4">
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
        <ul className="space-y-4">
          {filtrados.map((item) => (
            <li key={item.id} className="relative rounded-lg border border-border bg-card p-5">
              <Badge
                variant={item.ativo ? "default" : "secondary"}
                className="absolute top-5 right-5"
              >
                {item.ativo ? "Ativo" : "Inativo"}
              </Badge>
              <h2 className="mb-4 text-lg font-semibold">{item.nome}</h2>

              <div className="mb-4 grid grid-cols-3 gap-2">
                <div className="min-w-0">
                  <div className="mb-1 truncate text-[13px] text-muted-foreground">Email</div>
                  <div className="truncate text-[15.5px] font-medium">{item.email}</div>
                </div>
                <div className="min-w-0">
                  <div className="mb-1 truncate text-[13px] text-muted-foreground">Perfil</div>
                  <div className="truncate text-[15.5px] font-medium">{item.perfil}</div>
                </div>
                <div className="min-w-0">
                  <div className="mb-1 truncate text-[13px] text-muted-foreground">Depósito Padrão</div>
                  <div className="truncate text-[15.5px] font-medium">{item.depositoPadrao}</div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button render={<Link href={`/usuarios/${item.id}`} />} size="sm">
                  Editar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
