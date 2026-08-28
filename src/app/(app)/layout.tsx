import { redirect } from "next/navigation";
import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { podeGerenciarUsuarios } from "@/lib/permissions";

const NAV_ITEMS = [
  { href: "/", label: "Início" },
  { href: "/produtos", label: "Produtos" },
  { href: "/movimentacoes/nova", label: "Nova Movimentação" },
  { href: "/estoque", label: "Posição de Estoque" },
  { href: "/fornecedores", label: "Fornecedores" },
  { href: "/clientes", label: "Clientes" },
  { href: "/depositos", label: "Depósitos" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const isAdmin = podeGerenciarUsuarios(session.user.perfil);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-background">
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <span className="font-semibold">Controle de Estoque</span>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="hidden sm:inline">
              {session.user.name} · {session.user.perfil}
            </span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button type="submit" className="underline underline-offset-2 hover:text-foreground">
                Sair
              </button>
            </form>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t px-4 py-2 text-sm">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-md px-3 py-1.5 hover:bg-muted"
            >
              {item.label}
            </Link>
          ))}
          {isAdmin && (
            <Link href="/usuarios" className="whitespace-nowrap rounded-md px-3 py-1.5 hover:bg-muted">
              Usuários
            </Link>
          )}
        </nav>
      </header>
      <main className="flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
