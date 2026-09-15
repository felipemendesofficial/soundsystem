"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const OPCOES: Record<string, string> = {
  positivo: "Com saldo",
  zero: "Saldo zerado",
};

export function SaldoFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const atual = searchParams.get("saldo") ?? "positivo";

  return (
    <Select
      value={atual}
      items={OPCOES}
      onValueChange={(valor) => {
        const params = new URLSearchParams(searchParams.toString());
        if (!valor || valor === "positivo") {
          params.delete("saldo");
        } else {
          params.set("saldo", valor);
        }
        router.push(`${pathname}?${params.toString()}`);
      }}
    >
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(OPCOES).map(([valor, label]) => (
          <SelectItem key={valor} value={valor}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
