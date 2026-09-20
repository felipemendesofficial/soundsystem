"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";

export type ItemCliente = {
  id: string;
  nome: string;
  tipo: string;
  telefone: string;
  email: string;
  saldoAdiantamento: string | null;
  creditoDevolucao: string | null;
  buscaTexto: string;
};

export function ClientesLista({ itens }: { itens: ItemCliente[] }) {
  const [busca, setBusca] = useState("");

  const termo = busca.trim().toLowerCase();
  const filtrados = termo ? itens.filter((i) => i.buscaTexto.includes(termo)) : itens;

  return (
    <div className="space-y-2">
      <Input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por nome, telefone ou email"
        aria-label="Buscar cliente"
      />

      {filtrados.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          {termo ? `Nenhum cliente encontrado para "${busca.trim()}".` : "Nenhum cliente cadastrado."}
        </p>
      ) : (
        <ul className="space-y-2">
          {filtrados.map((item) => (
            <li key={item.id} className="rounded-lg border border-border bg-card">
              <Link href={`/clientes/${item.id}`} className="relative block p-3 active:bg-accent">
                <span className="absolute top-3.5 right-3 size-2.5 rounded-full bg-accent" />
                <h2 className="mb-2 text-[15px] font-semibold">{item.nome}</h2>

                <div className="grid grid-cols-3 gap-x-2 gap-y-1.5">
                  <div className="min-w-0">
                    <div className="truncate text-[11px] leading-tight text-muted-foreground">Tipo</div>
                    <div className="truncate text-[14px] leading-tight font-medium">{item.tipo}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[11px] leading-tight text-muted-foreground">Telefone</div>
                    <div className="truncate text-[14px] leading-tight font-medium">{item.telefone}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[11px] leading-tight text-muted-foreground">Email</div>
                    <div className="truncate text-[14px] leading-tight font-medium">{item.email}</div>
                  </div>
                </div>
              </Link>
              {item.saldoAdiantamento !== null && (
                <Link
                  href={`/clientes/${item.id}/adiantamento`}
                  className="flex items-center justify-between border-t border-border px-3 py-2 text-sm active:bg-accent"
                >
                  <span className="text-muted-foreground">Saldo de adiantamento</span>
                  <span className="font-medium text-primary">{item.saldoAdiantamento}</span>
                </Link>
              )}
              {item.creditoDevolucao !== null && (
                <div className="flex items-center justify-between border-t border-border px-3 py-2 text-sm">
                  <span className="text-muted-foreground">Crédito de devolução</span>
                  <span className="font-medium text-primary">{item.creditoDevolucao}</span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
