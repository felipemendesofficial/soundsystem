"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function DepositoFilter({ depositos }: { depositos: { id: string; nome: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const atual = searchParams.get("depositoId") ?? "todos";

  return (
    <Select
      value={atual}
      items={{ todos: "Todos os depósitos", ...Object.fromEntries(depositos.map((d) => [d.id, d.nome])) }}
      onValueChange={(valor) => {
        const params = new URLSearchParams(searchParams.toString());
        if (!valor || valor === "todos") {
          params.delete("depositoId");
        } else {
          params.set("depositoId", valor);
        }
        router.push(`${pathname}?${params.toString()}`);
      }}
    >
      <SelectTrigger className="w-56">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="todos">Todos os depósitos</SelectItem>
        {depositos.map((d) => (
          <SelectItem key={d.id} value={d.id}>
            {d.nome}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
