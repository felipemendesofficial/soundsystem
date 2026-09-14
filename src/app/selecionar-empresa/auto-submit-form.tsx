"use client";

import { useEffect, useRef } from "react";

/**
 * Envia o form sozinho assim que monta — usado pro caso de 1 empresa só
 * (auto-seleciona sem exigir clique). Precisa ser um submit de verdade (não
 * uma chamada direta da Server Action durante o render do Server Component):
 * Next.js só permite mutar cookies (o que `selecionarEmpresa`/`unstable_update`
 * fazem) dentro de uma Server Action ou Route Handler de fato, nunca durante
 * a renderização de um componente.
 */
export function AutoSubmitForm({ action }: { action: () => Promise<void> }) {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    formRef.current?.requestSubmit();
  }, []);

  return (
    <form ref={formRef} action={action}>
      <p className="text-center text-sm text-muted-foreground">Entrando...</p>
    </form>
  );
}
