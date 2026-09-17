"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin/grupos", label: "Grupos" },
  { href: "/admin/alineas-devolucao-cheque", label: "Alíneas de Devolução" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-4 pt-3">
      {ITEMS.map((item) => {
        const ativo = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn("text-[13px] font-medium text-white/60", ativo && "text-white")}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
