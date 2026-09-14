import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { selecionarEmpresa } from "./actions";
import { AutoSubmitForm } from "./auto-submit-form";

export default async function SelecionarEmpresaPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.perfil === "master") redirect("/admin");

  const acessos = await db.usuarioEmpresa.findMany({
    where: { usuarioId: session.user.id },
    include: { empresa: true },
    orderBy: { empresa: { nome: "asc" } },
  });

  if (acessos.length === 1) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
        <AutoSubmitForm action={selecionarEmpresa.bind(null, acessos[0].empresaId)} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm rounded-lg border bg-background p-6 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold">Selecionar Empresa</h1>
        <p className="mb-6 text-sm text-muted-foreground">Escolha a empresa que você vai usar agora.</p>

        {acessos.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
            Você não tem acesso a nenhuma empresa. Fale com o administrador do seu grupo.
          </p>
        ) : (
          <div className="space-y-2">
            {acessos.map((acesso) => (
              <form key={acesso.empresaId} action={selecionarEmpresa.bind(null, acesso.empresaId)}>
                <Button type="submit" variant="outline" className="w-full justify-start">
                  {acesso.empresa.nome}
                </Button>
              </form>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
