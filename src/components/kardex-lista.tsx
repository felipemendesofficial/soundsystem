import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type ItemKardex = {
  id: string;
  data: string;
  depositoNome: string;
  tipoLabel: string;
  isEntrada: boolean;
  descritivo?: string;
  estornoLabel?: string;
  quantidade: string;
  custoUnitario?: string;
  custoMedioApos?: string;
  saldoQuantidade: string;
  saldoValor?: string;
  acao?: ReactNode;
};

export function KardexLista({
  itens,
  emptyMessage = "Nenhuma movimentação registrada para este produto.",
}: {
  itens: ItemKardex[];
  emptyMessage?: string;
}) {
  if (itens.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {itens.map((item) => (
        <li key={item.id} className="rounded-lg border border-border bg-card p-3">
          <div className="mb-2 flex items-center gap-2">
            <div
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full text-sm leading-none font-semibold",
                item.isEntrada ? "bg-brand-green/15 text-brand-green" : "bg-destructive/10 text-destructive"
              )}
              aria-hidden
            >
              {item.isEntrada ? "+" : "−"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-[13px] leading-tight font-semibold">{item.tipoLabel}</p>
                <Badge variant="secondary" className="h-[18px] shrink-0 px-1.5 text-[10px]">
                  {item.depositoNome}
                </Badge>
              </div>
              <p className="truncate text-[11px] leading-tight text-muted-foreground">
                {item.data}
                {item.descritivo && ` · ${item.descritivo}`}
                {item.estornoLabel && ` · ${item.estornoLabel}`}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-md bg-muted/50 px-2.5 py-1.5">
            <div className="min-w-0">
              <div
                className={cn(
                  "truncate text-[14px] leading-tight font-medium",
                  item.isEntrada ? "text-brand-green" : "text-destructive"
                )}
              >
                {item.isEntrada ? "+" : "−"}
                {item.quantidade}
              </div>
              {item.custoUnitario !== undefined && (
                <div className="truncate text-[10.5px] leading-tight text-muted-foreground">
                  {item.custoUnitario}/un
                </div>
              )}
            </div>
            <div className="min-w-0 text-right">
              <div className="truncate text-[14px] leading-tight font-medium">{item.saldoQuantidade}</div>
              {(item.saldoValor !== undefined || item.custoMedioApos !== undefined) && (
                <div className="truncate text-[10.5px] leading-tight text-muted-foreground">
                  {item.saldoValor}
                  {item.custoMedioApos !== undefined && ` · méd. ${item.custoMedioApos}`}
                </div>
              )}
            </div>
          </div>

          {item.acao && <div className="mt-2">{item.acao}</div>}
        </li>
      ))}
    </ul>
  );
}
