import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { podeGerenciarPlataforma } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/lib/actions/auth-actions";
import { Boxes } from "lucide-react";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user || !podeGerenciarPlataforma(session.user.perfil)) redirect("/");

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[400px] flex-col bg-background">
      <div className="bg-shell px-[18px] pt-4 pb-3.5 text-shell-foreground">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex size-[26px] items-center justify-center rounded-[5px] border-2 border-brand-yellow">
              <Boxes className="size-3.5 text-brand-yellow" />
            </div>
            <div className="font-mono text-[11px] tracking-[0.14em] text-white/70 uppercase">
              Plataforma · Master
            </div>
          </div>
          <form action={signOutAction}>
            <Button type="submit" variant="ghost" size="sm" className="text-shell-foreground hover:bg-white/10">
              Sair
            </Button>
          </form>
        </div>
      </div>
      <main className="flex-1 px-[18px] py-[18px]">{children}</main>
    </div>
  );
}
