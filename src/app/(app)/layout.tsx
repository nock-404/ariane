import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Wordmark } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { SESSION_COOKIE, roleOf } from "@/lib/auth";

import { NavLinks } from "./nav-links";
import { logout } from "./session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const role = roleOf(jar.get(SESSION_COOKIE)?.value);
  if (!role) redirect("/login");

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-50 flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line bg-surface/85 px-4 py-2.5 backdrop-blur-md">
        <Link href="/" className="flex items-center gap-3 rounded-md" aria-label="Ariane, zur Planung">
          <Wordmark size={26} />
          <span className="hidden border-l border-line pl-3 text-[11px] text-faint sm:inline">
            Benannt nach dem Faden der Ariadne
          </span>
        </Link>

        <NavLinks />

        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <form action={logout}>
            <Button variant="ghost" size="sm" type="submit" className="text-dim">
              Abmelden
            </Button>
          </form>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col p-4 pb-10">{children}</main>
    </div>
  );
}
