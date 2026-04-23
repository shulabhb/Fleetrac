export function humanizeLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return value
    .split(/[_\/\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function severityBadgeClasses(severity: string): string {
  if (severity === "high") {
    return "bg-rose-50 text-rose-700 ring-1 ring-rose-200";
  }
  if (severity === "medium") {
    return "bg-amber-50 text-amber-800 ring-1 ring-amber-200";
  }
  return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
}

export function postureBadgeClasses(posture: string): string {
  if (posture === "critical") {
    return "bg-red-50 text-red-800 ring-1 ring-red-200";
  }
  if (posture === "at_risk") {
    return "bg-rose-50 text-rose-700 ring-1 ring-rose-200";
  }
  if (posture === "watch") {
    return "bg-amber-50 text-amber-800 ring-1 ring-amber-200";
  }
  return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
}

export function lifecycleBadgeClasses(status: string): string {
  if (status === "escalated") return "bg-rose-50 text-rose-700 ring-1 ring-rose-200";
  if (status === "under_review") return "bg-amber-50 text-amber-800 ring-1 ring-amber-200";
  if (status === "mitigated") return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  if (status === "closed") return "bg-slate-100 text-slate-600 ring-1 ring-slate-200";
  return "bg-sky-50 text-sky-700 ring-1 ring-sky-200";
}

export function postureTone(
  posture: string | null | undefined
): "high" | "medium" | "low" | "neutral" | "info" {
  if (posture === "critical" || posture === "at_risk") return "high";
  if (posture === "watch") return "medium";
  if (posture === "healthy") return "low";
  return "neutral";
}

export function severityTone(
  severity: string | null | undefined
): "high" | "medium" | "low" | "neutral" {
  if (severity === "high") return "high";
  if (severity === "medium") return "medium";
  if (severity === "low") return "low";
  return "neutral";
}

export function connectionTone(
  status: string | null | undefined
): "bg-emerald-500" | "bg-amber-500" | "bg-rose-500" | "bg-slate-400" {
  if (status === "connected") return "bg-emerald-500";
  if (status === "degraded") return "bg-amber-500";
  if (status === "disconnected") return "bg-rose-500";
  return "bg-slate-400";
}

export function postureRank(posture: string): number {
  switch (posture) {
    case "critical":
      return 4;
    case "at_risk":
      return 3;
    case "watch":
      return 2;
    default:
      return 1;
  }
}

export function severityRank(severity: string): number {
  if (severity === "high") return 3;
  if (severity === "medium") return 2;
  return 1;
}

// Map a telemetry field / rule observed_field to a signal type bucket.
export function signalTypeForField(field: string | undefined | null): string {
  if (!field) return "Other";
  const key = field.toLowerCase();
  if (key.includes("drift")) return "Drift";
  if (key.includes("latency")) return "Latency";
  if (key.includes("ground")) return "Grounding";
  if (key.includes("accuracy") || key.includes("error")) return "Quality";
  if (key.includes("policy") || key.includes("violation")) return "Policy";
  if (key.includes("security") || key.includes("anomaly")) return "Security";
  if (key.includes("audit") || key.includes("coverage")) return "Audit";
  if (key.includes("cost")) return "Cost";
  if (key.includes("unsupported") || key.includes("retrieval")) return "Grounding";
  return "Other";
}

// Map a rule category string to an actionable risk domain taxonomy.
export function riskDomainFromCategory(category: string | undefined | null): string {
  if (!category) return "Governance / Compliance";
  const key = category.toLowerCase();
  if (key.includes("cyber")) return "Cyber Risk";
  if (key.includes("governance") || key.includes("compliance")) return "Governance / Compliance";
  if (key.includes("output") || key.includes("reliability") || key.includes("grounding")) return "Output Reliability";
  if (key.includes("technology") || key.includes("latency") || key.includes("drift")) return "Technology Risk";
  return humanizeLabel(category);
}

export function signalColor(signal: string): string {
  switch (signal) {
    case "Drift":
      return "bg-violet-50 text-violet-700 ring-1 ring-violet-200";
    case "Latency":
      return "bg-sky-50 text-sky-700 ring-1 ring-sky-200";
    case "Grounding":
      return "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200";
    case "Quality":
      return "bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200";
    case "Policy":
      return "bg-amber-50 text-amber-800 ring-1 ring-amber-200";
    case "Security":
      return "bg-rose-50 text-rose-700 ring-1 ring-rose-200";
    case "Audit":
      return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
    case "Cost":
      return "bg-teal-50 text-teal-700 ring-1 ring-teal-200";
    default:
      return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
  }
}

// Map a trigger metric / signal to a telemetry field key for charting.
export function telemetryFieldForMetric(metric: string | undefined | null): string | null {
  if (!metric) return null;
  const key = metric.toLowerCase();
  if (key.includes("drift")) return "drift_index";
  if (key.includes("latency")) return "latency_p95_ms";
  if (key.includes("ground")) return "grounding_score";
  if (key.includes("accuracy")) return "accuracy_pct";
  if (key.includes("error")) return "error_pct";
  if (key.includes("policy") || key.includes("violation")) return "policy_violation_rate";
  if (key.includes("audit") || key.includes("coverage")) return "audit_coverage_pct";
  if (key.includes("unsupported")) return "unsupported_claim_rate";
  if (key.includes("retrieval")) return "retrieval_failure_rate";
  if (key.includes("security") || key.includes("anomaly")) return "security_anomaly_count";
  if (key.includes("cost")) return "cost_per_1k_requests";
  return null;
}

export function metricLabel(field: string | null | undefined): string {
  if (!field) return "Metric";
  const map: Record<string, string> = {
    drift_index: "Drift Index",
    latency_p95_ms: "Latency p95 (ms)",
    grounding_score: "Grounding Score",
    accuracy_pct: "Accuracy %",
    error_pct: "Error %",
    policy_violation_rate: "Policy Violation Rate",
    audit_coverage_pct: "Audit Coverage %",
    unsupported_claim_rate: "Unsupported Claim Rate",
    retrieval_failure_rate: "Retrieval Failure Rate",
    security_anomaly_count: "Security Anomalies",
    cost_per_1k_requests: "Cost / 1k Requests"
  };
  return map[field] ?? humanizeLabel(field);
}
