"use client";

import { useActionState, useEffect, useRef, useState } from "react";
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
import type { LancamentoFormState } from "@/app/(app)/lancamentos/actions";

type Action = (prevState: LancamentoFormState, formData: FormData) => Promise<LancamentoFormState>;

function StatusButton({
  action,
  label,
  pendingLabel,
  variant,
  confirmTitle,
  confirmDescription,
}: {
  action: Action;
  label: string;
  pendingLabel: string;
  variant?: "default" | "outline" | "destructive";
  confirmTitle?: string;
  confirmDescription?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [open, setOpen] = useState(false);
  const submeteuRef = useRef(false);

  useEffect(() => {
    if (state.erro) {
      toast.error(state.erro);
    } else if (submeteuRef.current) {
      setOpen(false);
    }
    submeteuRef.current = false;
  }, [state]);

  if (!confirmTitle) {
    return (
      <form action={formAction} className="flex-none">
        <Button type="submit" disabled={pending} variant={variant} size="sm" className="whitespace-nowrap">
          {pending ? pendingLabel : label}
        </Button>
      </form>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button type="button" variant={variant} size="sm" className="flex-none whitespace-nowrap" />}
      >
        {label}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{confirmTitle}</DialogTitle>
          <DialogDescription>{confirmDescription}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Cancelar</DialogClose>
          <form action={formAction} onSubmit={() => (submeteuRef.current = true)}>
            <Button type="submit" disabled={pending} variant={variant} className="w-full">
              {pending ? pendingLabel : "Confirmar"}
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function LancamentoStatusActions({
  status,
  tipo,
  finalizarAction,
  cancelarFechamentoAction,
  excluirAction,
}: {
  status: "aberto" | "fechado";
  tipo: string;
  finalizarAction: Action;
  cancelarFechamentoAction: Action;
  excluirAction: Action;
}) {
  if (status === "aberto") {
    return (
      <>
        <StatusButton
          action={finalizarAction}
          label="Finalizar"
          pendingLabel="Finalizando..."
          confirmTitle="Finalizar lançamento?"
          confirmDescription="Isso lança a movimentação no estoque agora. Dá pra desfazer depois, cancelando o fechamento."
        />
        <StatusButton action={excluirAction} label="Excluir" pendingLabel="Excluindo..." variant="destructive" />
      </>
    );
  }

  if (tipo === "transferencia") return null;

  return (
    <StatusButton
      action={cancelarFechamentoAction}
      label="Cancelar Fechamento"
      pendingLabel="Cancelando..."
      variant="destructive"
    />
  );
}
