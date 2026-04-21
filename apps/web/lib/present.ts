export function humanizeLabel(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function severityBadgeClasses(severity: string): string {
  if (severity === "high") {
    return "bg-rose-100 text-rose-700 ring-1 ring-rose-200";
  }
  if (severity === "medium") {
    return "bg-amber-100 text-amber-700 ring-1 ring-amber-200";
  }
  return "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200";
}

export function postureBadgeClasses(posture: string): string {
  if (posture === "critical") {
    return "bg-red-100 text-red-700 ring-1 ring-red-200";
  }
  if (posture === "at_risk") {
    return "bg-rose-100 text-rose-700 ring-1 ring-rose-200";
  }
  if (posture === "watch") {
    return "bg-amber-100 text-amber-700 ring-1 ring-amber-200";
  }
  return "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200";
}
