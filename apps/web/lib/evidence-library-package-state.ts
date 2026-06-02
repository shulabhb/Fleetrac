import {
  OWNER_ACTIVE_INCIDENTS,
  OWNER_RESOLVED_ARCHIVE,
  type OwnerIncidentRecord,
  type ResolvedArchiveRecord
} from "@/lib/evidence-library-mock";

/** Re-export for components that only need the type. */
export type { OwnerIncidentRecord, ResolvedArchiveRecord };

export type LivePackageState = Record<
  string,
  { active: OwnerIncidentRecord[]; resolved: ResolvedArchiveRecord[] }
>;

export function createInitialLivePackages(): LivePackageState {
  const out: LivePackageState = {};
  for (const team of new Set([
    ...Object.keys(OWNER_ACTIVE_INCIDENTS),
    ...Object.keys(OWNER_RESOLVED_ARCHIVE)
  ])) {
    out[team] = {
      active: [...(OWNER_ACTIVE_INCIDENTS[team] ?? [])],
      resolved: [...(OWNER_RESOLVED_ARCHIVE[team] ?? [])]
    };
  }
  return out;
}

export function archiveIncidentInPackage(
  prev: LivePackageState,
  ownerTeam: string,
  incidentId: string,
  row: {
    title: string;
    systemName: string;
    outcome: string;
    evidenceCount: number;
    verificationResult: string;
  }
): LivePackageState {
  const pkg = prev[ownerTeam] ?? { active: [], resolved: [] };
  const active = pkg.active.filter((a) => a.id !== incidentId);
  const removed = pkg.active.find((a) => a.id === incidentId);
  const newResolved: ResolvedArchiveRecord = {
    id: incidentId,
    title: row.title,
    systemName: row.systemName,
    outcome: row.outcome,
    closedAt: "just now",
    evidenceCount: row.evidenceCount ?? removed?.evidenceCount ?? 0,
    verificationResult: row.verificationResult
  };
  return {
    ...prev,
    [ownerTeam]: {
      active,
      resolved: [newResolved, ...pkg.resolved]
    }
  };
}
