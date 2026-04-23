import { cn } from "@/lib/cn";

/**
 * Tasteful provider identifier: compact mark + brand-tinted surface.
 * Not official logos — avoids trademark noise while staying recognizable in demos.
 */
const MARKS: Record<
  string,
  { bg: string; text: string; abbr: string }
> = {
  aws: { bg: "bg-[#232F3E]", text: "text-white", abbr: "AWS" },
  azure: { bg: "bg-[#0078D4]", text: "text-white", abbr: "Az" },
  gcp: { bg: "bg-[#4285F4]", text: "text-white", abbr: "GCP" },
  databricks: { bg: "bg-[#FF3621]", text: "text-white", abbr: "DB" },
  snowflake: { bg: "bg-[#29B5E8]", text: "text-white", abbr: "Sn" },
  openai: { bg: "bg-slate-900", text: "text-white", abbr: "AI" },
  anthropic: { bg: "bg-[#D4A574]", text: "text-slate-900", abbr: "An" },
  vertex: { bg: "bg-[#4285F4]", text: "text-white", abbr: "Vx" },
  bedrock: { bg: "bg-[#FF9900]", text: "text-slate-900", abbr: "Br" },
  splunk: { bg: "bg-[#000000]", text: "text-white", abbr: "Sp" },
  datadog: { bg: "bg-[#632CA6]", text: "text-white", abbr: "DD" },
  jira: { bg: "bg-[#0052CC]", text: "text-white", abbr: "Ji" },
  servicenow: { bg: "bg-[#62D84E]", text: "text-slate-900", abbr: "SN" },
  airflow: { bg: "bg-[#017CEE]", text: "text-white", abbr: "Af" },
  argo: { bg: "bg-[#EF7B4D]", text: "text-white", abbr: "Ar" },
  mlflow: { bg: "bg-[#0194E2]", text: "text-white", abbr: "ML" },
  slack: { bg: "bg-[#4A154B]", text: "text-white", abbr: "Sl" },
  teams: { bg: "bg-[#6264A7]", text: "text-white", abbr: "Tm" },
  pagerduty: { bg: "bg-[#06AC38]", text: "text-white", abbr: "PD" },
  generic: { bg: "bg-slate-200", text: "text-slate-700", abbr: "—" }
};

const ID_TO_KEY: Record<string, string> = {
  int_aws: "aws",
  int_azure: "azure",
  int_gcp: "gcp",
  int_databricks: "databricks",
  int_snowflake: "snowflake",
  int_openai: "openai",
  int_azure_openai: "openai",
  int_anthropic: "anthropic",
  int_vertex: "vertex",
  int_bedrock: "bedrock",
  int_internal_model_api: "generic",
  int_splunk: "splunk",
  int_datadog: "datadog",
  int_jira: "jira",
  int_servicenow: "servicenow",
  int_airflow: "airflow",
  int_argo: "argo",
  int_mlflow: "mlflow",
  int_slack: "slack",
  int_teams: "teams",
  int_pagerduty: "pagerduty"
};

export function resolveProviderKey(
  id: string,
  explicit?: string | null
): string {
  if (explicit && MARKS[explicit]) return explicit;
  return ID_TO_KEY[id] ?? "generic";
}

export function IntegrationProviderMark({
  integrationId,
  providerKey,
  className
}: {
  integrationId: string;
  providerKey?: string | null;
  className?: string;
}) {
  const key = resolveProviderKey(integrationId, providerKey);
  const m = MARKS[key] ?? MARKS.generic;
  const abbr = m.abbr === "—" ? integrationId.replace("int_", "").slice(0, 2).toUpperCase() : m.abbr;
  return (
    <span
      className={cn(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[10px] font-bold tracking-tight",
        m.bg,
        m.text,
        className
      )}
      title={key}
    >
      {abbr}
    </span>
  );
}
