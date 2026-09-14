"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export type ItemGrupo = {
  id: string;
  nome: string;
  empresas: { nome: string; cnpj: string | null }[];
  ativo: boolean;
  buscaTexto: string;
};

export function GruposLista({ itens }: { itens: ItemGrupo[] }) {
  const [busca, setBusca] = useState("");

  const termo = busca.trim().toLowerCase();
  const filtrados = termo ? itens.filter((i) => i.buscaTexto.includes(termo)) : itens;

  return (
    <div className="space-y-4">
      <Input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por nome"
        aria-label="Buscar grupo"
      />

      {filtrados.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          {termo ? `Nenhum grupo encontrado para "${busca.trim()}".` : "Nenhum grupo cadastrado."}
        </p>
      ) : (
        <ul className="space-y-4">
          {filtrados.map((item) => (
            <li key={item.id}>
              <Link
                href={`/admin/grupos/${item.id}`}
                className="relative block rounded-lg border border-border bg-card p-5 active:bg-accent"
              >
                <Badge variant={item.ativo ? "default" : "secondary"} className="absolute top-5 right-5">
                  {item.ativo ? "Ativo" : "Inativo"}
                </Badge>
                <h2 className="mb-4 text-lg font-semibold">{item.nome}</h2>

                <div className="min-w-0">
                  <div className="mb-1 truncate text-[13px] text-muted-foreground">
                    {item.empresas.length === 1 ? "Empresa" : "Empresas"}
                  </div>
                  {item.empresas.length === 0 ? (
                    <div className="text-[15.5px] font-medium text-muted-foreground">Nenhuma</div>
                  ) : (
                    <div className="space-y-0.5">
                      {item.empresas.map((empresa, i) => (
                        <div key={i} className="truncate text-[15.5px] font-medium">
                          {empresa.nome}
                          {empresa.cnpj && (
                            <span className="ml-1.5 text-xs font-normal text-muted-foreground">{empresa.cnpj}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
