"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";

export type ItemEstoque = {
  id: string;
  produtoId: string;
  produtoNome: string;
  depositoNome: string;
  saldo: string;
  custoMedio?: string;
  valorTotal?: string;
};

export function EstoqueLista({
  itens,
  emptyMessage = "Nenhum item em estoque para o filtro selecionado.",
}: {
  itens: ItemEstoque[];
  emptyMessage?: string;
}) {
  const [busca, setBusca] = useState("");

  const termo = busca.trim().toLowerCase();
  const filtrados = termo ? itens.filter((i) => i.produtoNome.toLowerCase().includes(termo)) : itens;

  return (
    <div className="space-y-3">
      <Input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar produto por descrição..."
        aria-label="Buscar produto por descrição"
      />

      {filtrados.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          {termo ? "Nenhum produto encontrado para a busca." : emptyMessage}
        </p>
      ) : (
        <ul className="space-y-2">
          {filtrados.map((item) => (
            <li key={item.id} className="rounded-md border p-3">
              <Link href={`/kardex/${item.produtoId}`} className="font-medium underline underline-offset-2">
                {item.produtoNome}
              </Link>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                <div>
                  <dt className="text-xs text-muted-foreground">Depósito</dt>
                  <dd className="text-sm">{item.depositoNome}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Saldo (Qtd.)</dt>
                  <dd className="text-sm">{item.saldo}</dd>
                </div>
                {item.custoMedio !== undefined && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Custo Médio</dt>
                    <dd className="text-sm">{item.custoMedio}</dd>
                  </div>
                )}
                {item.valorTotal !== undefined && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Valor Total</dt>
                    <dd className="text-sm">{item.valorTotal}</dd>
                  </div>
                )}
              </dl>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
