/** Static product copy for Settings — not operational telemetry. */

export const FLEETRAC_OPERATING_SCOPE = {
  autoInScope: [
    "Notify accountable owners when detection rules fire on ingested telemetry",
    "Package evidence from normalized spans linked to incidents",
    "Surface bounded Fleetrac Analysis templates from live signal context"
  ],
  approvalGated: [
    "Governed remediation actions in Action Center",
    "Incident lifecycle advancement past owner review",
    "Verification outcomes that close the governance loop"
  ]
} as const;
