"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function CategoriaFilter({ categorias }: { categorias: { id: string; nome: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const atual = searchParams.get("categoriaId") ?? "todas";

  return (
    <Select
      value={atual}
      items={{ todas: "Todas as categorias", ...Object.fromEntries(categorias.map((c) => [c.id, c.nome])) }}
      onValueChange={(valor) => {
        const params = new URLSearchParams(searchParams.toString());
        if (!valor || valor === "todas") {
          params.delete("categoriaId");
        } else {
          params.set("categoriaId", valor);
        }
        router.push(`${pathname}?${params.toString()}`);
      }}
    >
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="todas">Todas as categorias</SelectItem>
        {categorias.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.nome}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
