"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STATUS_LABEL: Record<string, string> = {
  aberta: "Aberta",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export function StatusOSFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const atual = searchParams.get("status") ?? "todas";

  return (
    <Select
      value={atual}
      items={{ todas: "Todos os status", ...STATUS_LABEL }}
      onValueChange={(valor) => {
        const params = new URLSearchParams(searchParams.toString());
        if (!valor || valor === "todas") {
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
        <SelectItem value="todas">Todos os status</SelectItem>
        {Object.entries(STATUS_LABEL).map(([valor, label]) => (
          <SelectItem key={valor} value={valor}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
