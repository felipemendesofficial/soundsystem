"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export type ItemDeposito = {
  id: string;
  nome: string;
  endereco: string;
  ativo: boolean;
  buscaTexto: string;
};

export function DepositosLista({ itens }: { itens: ItemDeposito[] }) {
  const [busca, setBusca] = useState("");

  const termo = busca.trim().toLowerCase();
  const filtrados = termo ? itens.filter((i) => i.buscaTexto.includes(termo)) : itens;

  return (
    <div className="space-y-4">
      <Input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por nome ou endereço"
        aria-label="Buscar depósito"
      />

      {filtrados.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          {termo ? `Nenhum depósito encontrado para "${busca.trim()}".` : "Nenhum depósito cadastrado."}
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

              <div className="mb-4">
                <div className="mb-1 text-[13px] text-muted-foreground">Endereço</div>
                <div className="text-[15.5px] font-medium">{item.endereco}</div>
              </div>

              <div className="flex gap-3">
                <Button render={<Link href={`/depositos/${item.id}`} />} size="sm">
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
