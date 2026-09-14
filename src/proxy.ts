import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const isLoginPage = nextUrl.pathname.startsWith("/login");
  const isMaster = req.auth?.user?.perfil === "master";
  const isAdminArea = nextUrl.pathname.startsWith("/admin");
  const isSelecionarEmpresa = nextUrl.pathname.startsWith("/selecionar-empresa");

  if (!isLoggedIn && !isLoginPage) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL(isMaster ? "/admin" : "/", nextUrl));
  }

  // Master é o admin da plataforma (sem grupo/empresa) — só acessa /admin,
  // e é a única rota que ele acessa. Checado antes de tudo mais.
  if (isLoggedIn && isMaster && !isAdminArea) {
    return NextResponse.redirect(new URL("/admin", nextUrl));
  }
  if (isLoggedIn && !isMaster && isAdminArea) {
    return NextResponse.redirect(new URL("/", nextUrl));
  }

  // Usuário comum sem empresa ativa na sessão ainda — força a escolha antes
  // de qualquer outra tela (exceto a própria tela de seleção).
  if (isLoggedIn && !isMaster && !req.auth?.user?.empresaId && !isSelecionarEmpresa) {
    return NextResponse.redirect(new URL("/selecionar-empresa", nextUrl));
  }

  if (isLoggedIn && nextUrl.pathname.startsWith("/usuarios") && req.auth?.user?.perfil !== "admin") {
    return NextResponse.redirect(new URL("/", nextUrl));
  }

  const ROTAS_ADMIN_ESTOQUISTA = ["/orcamentos", "/tabela-precos"];
  if (
    isLoggedIn &&
    ROTAS_ADMIN_ESTOQUISTA.some((rota) => nextUrl.pathname.startsWith(rota)) &&
    req.auth?.user?.perfil !== "admin" &&
    req.auth?.user?.perfil !== "estoquista"
  ) {
    return NextResponse.redirect(new URL("/", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
