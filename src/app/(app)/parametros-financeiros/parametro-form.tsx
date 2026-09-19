"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { salvarParametroFinanceiro, type ParametroFinanceiroFormState } from "./actions";

type Action = (prevState: ParametroFinanceiroFormState, formData: FormData) => Promise<ParametroFinanceiroFormState>;

const labelClass = "text-[15px] font-semibold";
const inputClass = "h-11 px-3.5 text-base bg-card";

export function ParametroForm({
  planos,
  defaultValues,
}: {
  planos: { id: string; label: string }[];
  defaultValues: {
    planoAplicacaoId: string | null;
    planoResgateId: string | null;
    planoRendimentoId: string | null;
    percentualMultaPadrao: string | null;
  };
}) {
  const [state, formAction, pending] = useActionState<ParametroFinanceiroFormState, FormData>(
    salvarParametroFinanceiro as Action,
    {}
  );
  const itensPlanos = Object.fromEntries(planos.map((p) => [p.id, p.label]));

  useEffect(() => {
    if (state.sucesso) toast.success("Parâmetros salvos.");
    if (state.erro) toast.error(state.erro);
  }, [state]);

  return (
    <form action={formAction} className="max-w-md space-y-6">
      <div className="space-y-2">
        <Label htmlFor="planoAplicacaoId" className={labelClass}>Plano — Aplicação Financeira</Label>
        <Select name="planoAplicacaoId" defaultValue={defaultValues.planoAplicacaoId ?? undefined} items={itensPlanos}>
          <SelectTrigger id="planoAplicacaoId" className={`w-full ${inputClass}`}>
            <SelectValue placeholder="Nenhum" />
          </SelectTrigger>
          <SelectContent>
            {planos.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="planoResgateId" className={labelClass}>Plano — Resgate de Aplicação</Label>
        <Select name="planoResgateId" defaultValue={defaultValues.planoResgateId ?? undefined} items={itensPlanos}>
          <SelectTrigger id="planoResgateId" className={`w-full ${inputClass}`}>
            <SelectValue placeholder="Nenhum" />
          </SelectTrigger>
          <SelectContent>
            {planos.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="planoRendimentoId" className={labelClass}>Plano — Rendimento de Aplicação</Label>
        <Select name="planoRendimentoId" defaultValue={defaultValues.planoRendimentoId ?? undefined} items={itensPlanos}>
          <SelectTrigger id="planoRendimentoId" className={`w-full ${inputClass}`}>
            <SelectValue placeholder="Nenhum" />
          </SelectTrigger>
          <SelectContent>
            {planos.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="percentualMultaPadrao" className={labelClass}>Multa padrão por atraso na Baixa (%)</Label>
        <Input
          id="percentualMultaPadrao"
          name="percentualMultaPadrao"
          type="number"
          step="0.01"
          min="0"
          defaultValue={defaultValues.percentualMultaPadrao ?? "2"}
          className={inputClass}
        />
        <p className="text-xs text-muted-foreground">Sugestão pré-preenchida na tela de Baixa quando o vencimento já passou — sempre editável linha a linha.</p>
      </div>

      <Button type="submit" disabled={pending} className="h-11 px-7 text-base">
        {pending ? "Salvando..." : "Salvar"}
      </Button>
    </form>
  );
}
