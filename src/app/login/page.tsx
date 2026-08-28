import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { Wordmark } from "@/components/brand/logo";
import { SESSION_COOKIE, roleOf } from "@/lib/auth";

import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const jar = await cookies();
  if (roleOf(jar.get(SESSION_COOKIE)?.value)) redirect("/");

  return (
    <div className="flex min-h-full flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-7">
          <h1>
            <Wordmark size={40} />
            <span className="sr-only">Ariane</span>
          </h1>
          <p className="mt-2 text-[12.5px] text-faint">
            Ariane ist die französische Ariadne. Benannt nach ihrem Faden.
          </p>
        </div>

        <LoginForm />

        <p className="mt-4 px-1 text-[11.5px] leading-relaxed text-dim">
          In der Testphase gibt es ein gemeinsames Passwort statt eigener Konten. Sobald das
          Werkzeug wirklich im Einsatz ist, kommen richtige Anmeldungen dazu.
        </p>
      </div>
    </div>
  );
}
