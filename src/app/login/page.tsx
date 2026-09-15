import { LoginForm } from "./login-form";

// Nunca cachear esta página: ela embute o id da Server Action de login no
// HTML, que muda a cada deploy — servida estática (padrão do Next.js pra
// páginas sem dado dinâmico), um proxy/cache intermediário podia continuar
// devolvendo uma versão de antes de um deploy, com um id de Server Action
// que o servidor atual não reconhece mais ("Failed to find Server Action").
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <LoginForm />
    </div>
  );
}
