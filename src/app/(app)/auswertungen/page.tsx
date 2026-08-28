import { ReportView } from "@/components/reports/report-view";
import { loadPlan } from "@/lib/plan";
import { requireReader } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AuswertungenPage() {
  const [data] = await Promise.all([loadPlan(), requireReader()]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 pb-14">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold tracking-tight">Auswertungen</h1>
        <p className="text-sm text-dim">
          Dieselbe Rechnung wie im Raster, nur zusammengefasst: verfügbar ist die Netto-Kapazität
          abzüglich Urlaub und Feiertagen.
        </p>
      </header>

      <ReportView data={data} />
    </div>
  );
}
