import { FLEETRAC_OPERATING_SCOPE } from "@/lib/fleetrac-operating-scope";

export function FleetracOperatingScopePanel() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-slate-900">Fleetrac operating scope</p>
      <p className="mt-1 text-[12px] leading-relaxed text-slate-600">
        Prototype policy boundaries for what Fleetrac may execute automatically vs what requires
        human approval. Production deployments map these to your governance policy engine.
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
            Auto in scope
          </p>
          <ul className="mt-2 list-inside list-disc text-[12px] text-slate-700">
            {FLEETRAC_OPERATING_SCOPE.autoInScope.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-800">
            Approval required
          </p>
          <ul className="mt-2 list-inside list-disc text-[12px] text-slate-700">
            {FLEETRAC_OPERATING_SCOPE.approvalGated.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
