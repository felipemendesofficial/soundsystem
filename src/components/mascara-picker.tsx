"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * Escolhe qual máscara (árvore) ver — mesmo padrão de `deposito-filter.tsx`,
 * reusado pelas 3 famílias (Plano Financeiro, Centro de Custo, Processo) já
 * que todas guardam a máscara em visualização como `?mascaraId=` na URL.
 */
export function MascaraPicker({ mascaras, atual }: { mascaras: { id: string; nome: string }[]; atual: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <Select
      value={atual}
      items={Object.fromEntries(mascaras.map((m) => [m.id, m.nome]))}
      onValueChange={(valor) => {
        if (!valor) return;
        const params = new URLSearchParams(searchParams.toString());
        params.set("mascaraId", valor);
        router.push(`${pathname}?${params.toString()}`);
      }}
    >
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {mascaras.map((m) => (
          <SelectItem key={m.id} value={m.id}>
            {m.nome}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
