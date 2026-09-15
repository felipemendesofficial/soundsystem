"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TIPO_LABEL: Record<string, string> = {
  compra: "Compra",
  devolucao_cliente: "Devolução de Cliente",
  ajuste_entrada: "Ajuste (Entrada)",
  venda: "Venda",
  devolucao_fornecedor: "Devolução a Fornecedor",
  perda_avaria: "Perda / Avaria",
  uso_interno: "Uso Interno",
  ajuste_saida: "Ajuste (Saída)",
  transferencia: "Transferência",
};

export function TipoLancamentoFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const atual = searchParams.get("tipo") ?? "todos";

  return (
    <Select
      value={atual}
      items={{ todos: "Todos os tipos", ...TIPO_LABEL }}
      onValueChange={(valor) => {
        const params = new URLSearchParams(searchParams.toString());
        if (!valor || valor === "todos") {
          params.delete("tipo");
        } else {
          params.set("tipo", valor);
        }
        router.push(`${pathname}?${params.toString()}`);
      }}
    >
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="todos">Todos os tipos</SelectItem>
        {Object.entries(TIPO_LABEL).map(([valor, label]) => (
          <SelectItem key={valor} value={valor}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
