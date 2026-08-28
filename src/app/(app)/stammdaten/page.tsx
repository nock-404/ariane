import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PeoplePanel } from "@/components/stamm/people-panel";
import { ProjectsPanel } from "@/components/stamm/projects-panel";
import { loadPlan } from "@/lib/plan";
import { requireReader } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function StammdatenPage() {
  const [data, role] = await Promise.all([loadPlan(), requireReader()]);

  if (role !== "writer") {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-3 rounded-lg border border-line bg-surface p-14 text-center shadow-[var(--shadow-soft)]">
        <p className="font-semibold">Stammdaten sind für diesen Zugang gesperrt</p>
        <p className="max-w-md text-sm text-dim">
          Mit dem Lesezugang kannst du die Planung ansehen und exportieren, aber Personen und
          Projekte nicht ändern.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 pb-14">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold tracking-tight">Stammdaten</h1>
        <p className="text-sm text-dim">
          Wer im Team ist, wie viel Zeit jede Person hat, und welche Projekte es gibt.
        </p>
      </header>

      <Tabs defaultValue="people">
        <TabsList>
          <TabsTrigger value="people">Personen</TabsTrigger>
          <TabsTrigger value="projects">Projekte</TabsTrigger>
        </TabsList>
        <TabsContent value="people" className="mt-4">
          <PeoplePanel data={data} />
        </TabsContent>
        <TabsContent value="projects" className="mt-4">
          <ProjectsPanel data={data} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
