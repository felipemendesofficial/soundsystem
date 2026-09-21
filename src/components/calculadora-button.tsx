"use client";

import { useState } from "react";
import { Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Operador = "+" | "-" | "×" | "÷";

function aplicarOperador(a: number, b: number, operador: Operador): number | null {
  switch (operador) {
    case "+":
      return a + b;
    case "-":
      return a - b;
    case "×":
      return a * b;
    case "÷":
      return b === 0 ? null : a / b;
  }
}

/** Formata o resultado sem casas decimais espúrias de ponto flutuante (ex.: 0.1+0.2), mas preserva o que o usuário digitou. */
function formatarResultado(valor: number): string {
  if (!Number.isFinite(valor)) return "Erro";
  return String(Math.round(valor * 100) / 100);
}

const TECLAS = [
  ["7", "8", "9", "÷"],
  ["4", "5", "6", "×"],
  ["1", "2", "3", "-"],
  ["0", ".", "=", "+"],
] as const;

/** Calculadora básica (operações sequenciais, sem precedência) — o resultado, ao confirmar, substitui o campo de valor que abriu a calculadora. */
export function CalculadoraButton({ valorAtual, onResultado }: { valorAtual: string; onResultado: (valor: string) => void }) {
  const [open, setOpen] = useState(false);
  const [display, setDisplay] = useState("0");
  const [acumulado, setAcumulado] = useState<number | null>(null);
  const [operador, setOperador] = useState<Operador | null>(null);
  const [aguardandoNovoNumero, setAguardandoNovoNumero] = useState(true);

  function alternarAberto(novoAberto: boolean) {
    if (novoAberto) {
      const inicial = Number(valorAtual);
      setDisplay(valorAtual && !Number.isNaN(inicial) && inicial > 0 ? String(inicial) : "0");
      setAcumulado(null);
      setOperador(null);
      setAguardandoNovoNumero(true);
    }
    setOpen(novoAberto);
  }

  function digitar(digito: string) {
    if (display === "Erro" || aguardandoNovoNumero) {
      setDisplay(digito === "." ? "0." : digito);
      setAguardandoNovoNumero(false);
      return;
    }
    if (digito === "." && display.includes(".")) return;
    setDisplay((atual) => (atual === "0" && digito !== "." ? digito : atual + digito));
  }

  function escolherOperador(novoOperador: Operador) {
    if (display === "Erro") return;
    const atual = Number(display);
    if (operador && !aguardandoNovoNumero && acumulado !== null) {
      const resultado = aplicarOperador(acumulado, atual, operador);
      if (resultado === null) {
        setDisplay("Erro");
        setAcumulado(null);
        setOperador(null);
        setAguardandoNovoNumero(true);
        return;
      }
      setAcumulado(resultado);
      setDisplay(formatarResultado(resultado));
    } else {
      setAcumulado(atual);
    }
    setOperador(novoOperador);
    setAguardandoNovoNumero(true);
  }

  function igual() {
    if (display === "Erro" || operador === null || acumulado === null) return;
    const resultado = aplicarOperador(acumulado, Number(display), operador);
    if (resultado === null) {
      setDisplay("Erro");
    } else {
      setDisplay(formatarResultado(resultado));
    }
    setAcumulado(null);
    setOperador(null);
    setAguardandoNovoNumero(true);
  }

  function limpar() {
    setDisplay("0");
    setAcumulado(null);
    setOperador(null);
    setAguardandoNovoNumero(true);
  }

  function apagar() {
    if (display === "Erro" || aguardandoNovoNumero) {
      limpar();
      return;
    }
    setDisplay((atual) => (atual.length > 1 ? atual.slice(0, -1) : "0"));
  }

  function confirmar() {
    if (display !== "Erro" && Number(display) > 0) {
      onResultado(Number(display).toFixed(2));
    }
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={alternarAberto}>
      <DialogTrigger render={<Button type="button" variant="outline" size="icon" aria-label="Abrir calculadora" />}>
        <Calculator className="size-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Calculadora</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-muted px-4 py-3 text-right text-2xl font-semibold tabular-nums">
            {display}
          </div>

          <div className="grid grid-cols-4 gap-2">
            <Button type="button" variant="outline" onClick={limpar}>C</Button>
            <Button type="button" variant="outline" onClick={apagar}>⌫</Button>
            <div />
            <div />
            {TECLAS.flat().map((tecla) => {
              if (tecla === "=") {
                return (
                  <Button key={tecla} type="button" onClick={igual}>
                    =
                  </Button>
                );
              }
              if (tecla === "+" || tecla === "-" || tecla === "×" || tecla === "÷") {
                return (
                  <Button key={tecla} type="button" variant="secondary" onClick={() => escolherOperador(tecla)}>
                    {tecla}
                  </Button>
                );
              }
              return (
                <Button key={tecla} type="button" variant="outline" onClick={() => digitar(tecla)}>
                  {tecla}
                </Button>
              );
            })}
          </div>

          <div className="flex gap-2">
            <DialogClose render={<Button type="button" variant="outline" className="flex-1" />}>Cancelar</DialogClose>
            <Button type="button" className="flex-1" onClick={confirmar}>
              Usar Valor
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
