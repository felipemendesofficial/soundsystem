"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function DataLancamentoFilter({ padrao }: { padrao: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const data = searchParams.get("data");
  const valorAtual = data === "todos" ? "" : (data ?? padrao);

  function aplicar(valor: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("data", valor === "" ? "todos" : valor);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        type="date"
        value={valorAtual}
        onChange={(e) => aplicar(e.target.value)}
        className="h-11 flex-1 bg-card text-base"
        aria-label="Filtrar por data"
      />
      {data !== "todos" && (
        <Button type="button" variant="outline" size="sm" onClick={() => aplicar("")}>
          Todas as datas
        </Button>
      )}
    </div>
  );
}
