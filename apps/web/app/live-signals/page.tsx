import { SectionTitle } from "@/components/ui/section-title";
import { Card } from "@/components/ui/card";

export default function LiveSignalsPage() {
  return (
    <section className="space-y-5">
      <SectionTitle
        eyebrow="Observe · Signal hygiene"
        title="Live Signals"
        caption="Streaming governance-relevant signals across production AI — curated for triage, not raw telemetry noise."
      />
      <Card className="border-dashed border-slate-200 bg-slate-50/50 p-8 shadow-none">
        <p className="text-sm leading-relaxed text-slate-700">
          This workflow is next on the roadmap. You will use it to scan live control posture, drift, and policy signals
          before they become incidents — without leaving the governance narrative.
        </p>
        <p className="mt-3 text-[13px] font-medium text-slate-900">Coming next in workflow</p>
        <p className="mt-1 text-sm text-slate-600">
          For now, start from <strong className="font-semibold text-slate-800">Governance Insights</strong> on the
          Dashboard and route open work through the Incident Queue and Action Center.
        </p>
      </Card>
    </section>
  );
}
