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

type EstadoAcao = { erro?: string };
type Action = (prevState: EstadoAcao, formData: FormData) => Promise<EstadoAcao>;

/** Botão genérico "confirmar antes de executar" para ações consequentes sem tela própria (processar/estornar/excluir). */
export function ConfirmarAcaoButton({
  action,
  label,
  labelPendente,
  titulo,
  descricao,
  variant,
}: {
  action: Action;
  label: string;
  labelPendente: string;
  titulo: string;
  descricao: string;
  variant?: "outline";
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (state.erro) toast.error(state.erro);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant={variant} className={variant ? "border-destructive text-destructive hover:bg-destructive/10" : ""} />}>
        {label}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descricao}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Cancelar</DialogClose>
          <form action={formAction}>
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? labelPendente : label}
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
