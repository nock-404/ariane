import { PlanShell } from "@/components/plan/plan-shell";
import { loadPlan } from "@/lib/plan";
import { requireReader } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function PlanPage() {
  const [data, role] = await Promise.all([loadPlan(), requireReader()]);
  return <PlanShell data={data} readOnly={role !== "writer"} />;
}
