import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { podeGerenciarUsuarios } from "@/lib/permissions";
import { TopBar } from "@/components/app-shell/top-bar";
import { BottomNav } from "@/components/app-shell/bottom-nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const isAdmin = podeGerenciarUsuarios(session.user.perfil);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[400px] flex-col bg-background">
      <TopBar name={session.user.name} perfil={session.user.perfil} />
      <div className="barcode-divider" />
      <main className="flex-1 px-[18px] pb-[86px] pt-[18px]">{children}</main>
      <BottomNav isAdmin={isAdmin} />
    </div>
  );
}
