"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Planung" },
  { href: "/auswertungen", label: "Auswertungen" },
  { href: "/stammdaten", label: "Stammdaten" },
  { href: "/einstellungen", label: "Einstellungen" },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1" aria-label="Hauptnavigation">
      {LINKS.map((link) => {
        const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className="rounded-md px-2.5 py-1 text-[13px] transition-colors data-[active=true]:bg-accent data-[active=true]:font-semibold data-[active=false]:text-dim hover:bg-raised"
            data-active={active}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
