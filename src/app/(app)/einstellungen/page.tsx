import { Separator } from "@/components/ui/separator";
import { ThemePicker } from "@/components/settings/theme-picker";
import { TeamSettings } from "@/components/settings/team-settings";
import { loadPlan } from "@/lib/plan";
import { requireReader } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function EinstellungenPage() {
  const [data, role] = await Promise.all([loadPlan(), requireReader()]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-14">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold tracking-tight">Einstellungen</h1>
        <p className="text-sm text-dim">
          Das Aussehen gilt nur für dich, die Feiertage für alle.
        </p>
      </header>

      <TeamSettings value={data.defaultRegion} readOnly={role !== "writer"} />

      <Separator />

      <ThemePicker />
    </div>
  );
}
