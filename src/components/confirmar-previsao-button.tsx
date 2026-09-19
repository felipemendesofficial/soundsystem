"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { LancamentoFinanceiroFormState } from "@/app/(app)/lancamentos-financeiros/actions";

type Action = (prevState: LancamentoFinanceiroFormState, formData: FormData) => Promise<LancamentoFinanceiroFormState>;

export function ConfirmarPrevisaoButton({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, {});
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (state.erro) toast.error(state.erro);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" size="sm" className="flex-none whitespace-nowrap" />}>
        Confirmar Previsão
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar previsão?</DialogTitle>
          <DialogDescription>
            Isso converte o lançamento de Previsão para Real, liberando-o para receber Baixa. Não tem volta.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Cancelar</DialogClose>
          <form action={formAction}>
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "Confirmando..." : "Confirmar"}
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
