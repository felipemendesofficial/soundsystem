"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STATUS_LABEL: Record<string, string> = {
  aberto: "Aberto",
  fechado: "Fechado",
};

export function StatusLancamentoFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const atual = searchParams.get("status") ?? "todos";

  return (
    <Select
      value={atual}
      items={{ todos: "Todos os status", ...STATUS_LABEL }}
      onValueChange={(valor) => {
        const params = new URLSearchParams(searchParams.toString());
        if (!valor || valor === "todos") {
          params.delete("status");
        } else {
          params.set("status", valor);
        }
        router.push(`${pathname}?${params.toString()}`);
      }}
    >
      <SelectTrigger className="w-56">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="todos">Todos os status</SelectItem>
        {Object.entries(STATUS_LABEL).map(([valor, label]) => (
          <SelectItem key={valor} value={valor}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
