"use client";

import { useActionState, useEffect, useState } from "react";
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
import type { LancamentoFinanceiroFormState } from "@/app/(app)/lancamentos-financeiros/actions";

type Action = (prevState: LancamentoFinanceiroFormState, formData: FormData) => Promise<LancamentoFinanceiroFormState>;

/**
 * Cancelamento nunca é DELETE físico (`status: aberto -> cancelado`). Quando
 * o título faz parte de um parcelamento (`totalParcela` fields presentes),
 * pergunta o escopo antes — só esta parcela, ou todas as pendentes do grupo
 * (`totalAbertoNoGrupo` já vem do server, contando a própria). Título avulso
 * pula direto pro motivo, sem a pergunta de escopo.
 */
export function CancelarLancamentoButton({
  action,
  numeroParcela,
  totalParcelas,
  totalAbertoNoGrupo,
}: {
  action: Action;
  numeroParcela?: number | null;
  totalParcelas?: number | null;
  totalAbertoNoGrupo?: number;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [open, setOpen] = useState(false);
  const [escopo, setEscopo] = useState<"apenas_esta" | "todas_pendentes">("apenas_esta");
  const [motivo, setMotivo] = useState("");

  const fazParteDeGrupo = !!totalParcelas && (totalAbertoNoGrupo ?? 0) > 1;

  useEffect(() => {
    if (state.erro) toast.error(state.erro);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="outline" className="border-destructive text-destructive hover:bg-destructive/10" />}>
        Cancelar
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancelar título?</DialogTitle>
          <DialogDescription>
            O título não é apagado — fica marcado como Cancelado, disponível pra consulta depois. Só possível enquanto
            está aberto; um título já baixado se reverte por Estorno.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {fazParteDeGrupo && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Esta parcela ({numeroParcela}/{totalParcelas}) faz parte de um parcelamento. Há {totalAbertoNoGrupo}{" "}
                parcela(s) ainda pendente(s).
              </p>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="escopo-ui" checked={escopo === "apenas_esta"} onChange={() => setEscopo("apenas_esta")} />
                  Apenas esta parcela
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="escopo-ui" checked={escopo === "todas_pendentes"} onChange={() => setEscopo("todas_pendentes")} />
                  Todas as parcelas pendentes ({totalAbertoNoGrupo})
                </label>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="motivoCancelamento">Motivo do cancelamento</Label>
            <Input id="motivoCancelamento" value={motivo} onChange={(e) => setMotivo(e.target.value)} required />
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Voltar</DialogClose>
          <form action={formAction}>
            <input type="hidden" name="escopo" value={fazParteDeGrupo ? escopo : "apenas_esta"} />
            <input type="hidden" name="motivo" value={motivo} />
            <Button type="submit" disabled={pending || !motivo.trim()} variant="outline" className="w-full border-destructive text-destructive hover:bg-destructive/10">
              {pending ? "Cancelando..." : "Confirmar Cancelamento"}
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
