"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LancamentoFinanceiroFormState } from "@/app/(app)/lancamentos-financeiros/actions";

type Action = (prevState: LancamentoFinanceiroFormState, formData: FormData) => Promise<LancamentoFinanceiroFormState>;

/** Edição isolada da Data de Previsão — sem passar pela trava de Fechamento Diário, só pelo status `aberto` (checado server-side em `atualizarDataPrevisao`). */
export function DataPrevisaoForm({ action, dataPrevisaoISO }: { action: Action; dataPrevisaoISO: string }) {
  const [state, formAction, pending] = useActionState(action, {});

  useEffect(() => {
    if (state.erro) toast.error(state.erro);
  }, [state]);

  return (
    <form action={formAction} className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">Data de Previsão</span>
      <div className="flex items-center gap-1.5">
        <Input type="date" name="dataPrevisao" defaultValue={dataPrevisaoISO} required className="h-8 w-[152px] px-2 text-sm" />
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </form>
  );
}
