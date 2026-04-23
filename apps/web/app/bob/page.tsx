import { Info } from "lucide-react";
import { BobCopilotView } from "@/components/bob/bob-copilot-view";
import { SectionTitle } from "@/components/ui/section-title";
import { getBobInvestigations } from "@/lib/api";
import { humanizeLabel } from "@/lib/present";

export const dynamic = "force-dynamic";

type MissingTarget = {
  type: string;
  id: string;
};

function parseMissing(raw?: string): MissingTarget | null {
  if (!raw) return null;
  const [type, ...rest] = raw.split(":");
  const id = rest.join(":");
  if (!type || !id) return null;
  return { type, id };
}

export default async function BobCopilotPage({
  searchParams
}: {
  searchParams?: Promise<{ status?: string; missing?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const { items } = await getBobInvestigations();
  const missing = parseMissing(params.missing);

  return (
    <section className="space-y-5">
      <SectionTitle
        eyebrow="Investigate · Governance copilot"
        title="Bob Copilot"
        caption="Investigations and recommendations awaiting review, approval, or follow-up."
      />

      {missing ? (
        <div className="flex items-start gap-2.5 rounded-md border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12px] text-amber-900">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" />
          <div className="min-w-0">
            <p className="font-semibold">
              No Bob review found for{" "}
              {humanizeLabel(missing.type).toLowerCase()} ·{" "}
              <span className="font-mono">{missing.id}</span>
            </p>
            <p className="mt-0.5 text-amber-800/80">
              Nothing is currently open. Showing all investigations below.
            </p>
          </div>
        </div>
      ) : null}

      <BobCopilotView
        investigations={items}
        defaultStatusFilter={params.status}
      />
    </section>
  );
}
