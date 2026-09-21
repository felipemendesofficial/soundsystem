"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { FileText, Paperclip, Trash2, X } from "lucide-react";
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
import { gerarUrlUploadAnexo, confirmarAnexoLancamento, removerAnexoLancamento } from "@/app/(app)/lancamentos-financeiros/anexos-actions";

export type ItemAnexo = {
  id: string;
  nomeArquivo: string;
  tipoMime: string;
  tamanhoLabel: string;
  criadoEmLabel: string;
  enviadoPorNome: string;
  urlVisualizacao: string;
};

const TIPOS_ACEITOS = "image/jpeg,image/png,image/webp,image/heic,application/pdf";

function BotaoRemover({ anexoId }: { anexoId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirmar() {
    startTransition(async () => {
      const resultado = await removerAnexoLancamento(anexoId, {}, new FormData());
      if (resultado.erro) toast.error(resultado.erro);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="ghost" size="icon-xs" className="text-destructive" aria-label="Remover anexo" />}>
        <Trash2 />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remover anexo?</DialogTitle>
          <DialogDescription>O arquivo é removido definitivamente do armazenamento.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Cancelar</DialogClose>
          <Button type="button" disabled={pending} onClick={confirmar} className="w-full">
            {pending ? "Removendo..." : "Remover"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AnexosLancamento({ lancamentoId, anexos, podeRemover }: { lancamentoId: string; anexos: ItemAnexo[]; podeRemover: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);

  async function lidarComArquivos(arquivos: FileList | null) {
    if (!arquivos || arquivos.length === 0) return;
    setEnviando(true);

    for (const arquivo of Array.from(arquivos)) {
      const gerado = await gerarUrlUploadAnexo(lancamentoId, arquivo.name, arquivo.type, arquivo.size);
      if ("erro" in gerado) {
        toast.error(`${arquivo.name}: ${gerado.erro}`);
        continue;
      }

      try {
        const resposta = await fetch(gerado.url, { method: "PUT", body: arquivo, headers: { "Content-Type": arquivo.type } });
        if (!resposta.ok) throw new Error();
      } catch {
        toast.error(`Falha ao enviar ${arquivo.name}.`);
        continue;
      }

      const confirmado = await confirmarAnexoLancamento(lancamentoId, arquivo.name, gerado.chaveStorage, arquivo.type, arquivo.size);
      if (confirmado.erro) toast.error(`${arquivo.name}: ${confirmado.erro}`);
    }

    setEnviando(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Anexos</h2>
        <Button type="button" size="sm" variant="outline" disabled={enviando} onClick={() => inputRef.current?.click()}>
          <Paperclip className="size-3.5" />
          {enviando ? "Enviando..." : "Adicionar Anexo"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={TIPOS_ACEITOS}
          className="hidden"
          onChange={(e) => lidarComArquivos(e.target.files)}
        />
      </div>

      {anexos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum anexo ainda.</p>
      ) : (
        <ul className="space-y-2">
          {anexos.map((anexo) => (
            <li key={anexo.id} className="flex items-center gap-3 rounded-md border border-border p-2">
              <a href={anexo.urlVisualizacao} target="_blank" rel="noopener noreferrer" className="flex-none">
                {anexo.tipoMime.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element -- signed URL de bucket externo, não passa pelo otimizador de imagem do Next.
                  <img src={anexo.urlVisualizacao} alt={anexo.nomeArquivo} className="size-14 rounded object-cover" />
                ) : (
                  <span className="flex size-14 items-center justify-center rounded bg-muted">
                    <FileText className="size-6 text-muted-foreground" />
                  </span>
                )}
              </a>
              <a href={anexo.urlVisualizacao} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{anexo.nomeArquivo}</div>
                <div className="text-xs text-muted-foreground">
                  {anexo.tamanhoLabel} · {anexo.criadoEmLabel} · {anexo.enviadoPorNome}
                </div>
              </a>
              {podeRemover ? (
                <BotaoRemover anexoId={anexo.id} />
              ) : (
                <span className="flex-none text-muted-foreground" title="Só é possível remover anexos de um título em aberto">
                  <X className="size-4 opacity-30" />
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
