import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NovaEmpresaForm } from "./nova-empresa-form";
import { alternarAtivoEmpresa } from "../actions";

export default async function GrupoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const grupo = await db.grupoEmpresarial.findUnique({
    where: { id },
    include: { empresas: { orderBy: { nome: "asc" } } },
  });
  if (!grupo) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{grupo.nome}</h1>
        <Badge variant={grupo.ativo ? "default" : "secondary"} className="mt-2">
          {grupo.ativo ? "Ativo" : "Inativo"}
        </Badge>
      </div>

      <div className="space-y-3">
        <h2 className="text-base font-semibold">Empresas</h2>
        {grupo.empresas.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
            Nenhuma empresa cadastrada.
          </p>
        ) : (
          <ul className="space-y-2">
            {grupo.empresas.map((empresa) => (
              <li key={empresa.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{empresa.nome}</span>
                  <Badge variant={empresa.ativo ? "default" : "secondary"}>
                    {empresa.ativo ? "Ativa" : "Inativa"}
                  </Badge>
                </div>
                {empresa.cnpj && <div className="mt-1 text-xs text-muted-foreground">{empresa.cnpj}</div>}
                <form action={alternarAtivoEmpresa.bind(null, grupo.id, empresa.id, !empresa.ativo)} className="mt-3">
                  <Button
                    type="submit"
                    size="sm"
                    variant="outline"
                    className={empresa.ativo ? "border-destructive text-destructive hover:bg-destructive/10" : ""}
                  >
                    {empresa.ativo ? "Desativar" : "Ativar"}
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>

      <NovaEmpresaForm grupoId={grupo.id} />
    </div>
  );
}
