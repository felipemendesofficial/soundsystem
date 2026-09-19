"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import type { TransferenciaFormState } from "@/app/(app)/transferencias-entre-contas/actions";

type Action = (prevState: TransferenciaFormState, formData: FormData) => Promise<TransferenciaFormState>;

export function EstornarTransferenciaButton({ action }: { action: Action }) {
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>Estornar</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Estornar transferência?</DialogTitle>
          <DialogDescription>Cria uma transferência reversa e devolve o saldo das duas contas. Não tem volta.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-3" onSubmit={() => (submeteuRef.current = true)}>
          <div className="space-y-1">
            <Label htmlFor="motivo" className="text-sm font-semibold">Motivo</Label>
            <Input id="motivo" name="motivo" required />
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancelar</DialogClose>
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "Estornando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
