"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PeriodoFilter({
  padraoInicio,
  padraoFim,
}: {
  padraoInicio: string;
  padraoFim: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const todos = searchParams.get("periodo") === "todos";
  const dataInicio = todos ? "" : (searchParams.get("dataInicio") ?? padraoInicio);
  const dataFim = todos ? "" : (searchParams.get("dataFim") ?? padraoFim);

  function aplicar(inicio: string, fim: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("periodo");
    params.set("dataInicio", inicio);
    params.set("dataFim", fim);
    router.push(`${pathname}?${params.toString()}`);
  }

  function verTudo() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("dataInicio");
    params.delete("dataFim");
    params.set("periodo", "todos");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor="periodoDataInicio" className="mb-1 text-xs font-normal text-muted-foreground">
            De
          </Label>
          <Input
            id="periodoDataInicio"
            type="date"
            value={dataInicio}
            max={dataFim || undefined}
            onChange={(e) => aplicar(e.target.value, dataFim || padraoFim)}
            className="h-10 w-full bg-card text-sm"
          />
        </div>
        <div>
          <Label htmlFor="periodoDataFim" className="mb-1 text-xs font-normal text-muted-foreground">
            Até
          </Label>
          <Input
            id="periodoDataFim"
            type="date"
            value={dataFim}
            min={dataInicio || undefined}
            onChange={(e) => aplicar(dataInicio || padraoInicio, e.target.value)}
            className="h-10 w-full bg-card text-sm"
          />
        </div>
      </div>
      {!todos && (
        <button
          type="button"
          onClick={verTudo}
          className="text-xs text-primary underline underline-offset-2"
        >
          Ver todo o histórico
        </button>
      )}
    </div>
  );
}
