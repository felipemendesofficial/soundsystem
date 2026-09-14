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
import type { OrdemServicoFormState } from "@/app/(app)/ordens-servico/actions";

type Action = (prevState: OrdemServicoFormState, formData: FormData) => Promise<OrdemServicoFormState>;

function StatusButton({
  action,
  label,
  variant,
  confirmTitle,
  confirmDescription,
}: {
  action: Action;
  label: string;
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
          {pending ? "Aguarde..." : label}
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
              {pending ? "Aguarde..." : "Confirmar"}
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function OSStatusActions({
  status,
  iniciarAction,
  concluirAction,
  cancelarAction,
  estornarAction,
}: {
  status: "aberta" | "em_andamento" | "concluida" | "cancelada";
  iniciarAction: Action;
  concluirAction: Action;
  cancelarAction: Action;
  estornarAction: Action;
}) {
  if (status === "cancelada") return null;

  if (status === "concluida") {
    return <StatusButton action={estornarAction} label="Estornar Conclusão" variant="destructive" />;
  }

  return (
    <>
      {status === "aberta" && <StatusButton action={iniciarAction} label="Iniciar" variant="outline" />}
      <StatusButton
        action={concluirAction}
        label="Concluir"
        confirmTitle="Concluir Ordem de Serviço?"
        confirmDescription="Isso dá baixa dos produtos da OS no estoque agora. Dá pra desfazer depois, estornando a conclusão."
      />
      <StatusButton action={cancelarAction} label="Cancelar OS" variant="destructive" />
    </>
  );
}
