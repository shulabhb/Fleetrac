import type {
  OwnerIncidentRecord,
  ResolvedArchiveRecord
} from "@/lib/evidence-library-types";
import {
  buildLivePackagesFromApi
} from "@/lib/governance-merge";
import type { EvidenceLibraryResponseDTO } from "@/lib/governance-api";

/** Re-export for components that only need the type. */
export type { OwnerIncidentRecord, ResolvedArchiveRecord };

export type LivePackageState = Record<
  string,
  { active: OwnerIncidentRecord[]; resolved: ResolvedArchiveRecord[] }
>;

export function createInitialLivePackages(
  library?: EvidenceLibraryResponseDTO | null
): LivePackageState {
  if (library) {
    return buildLivePackagesFromApi(library);
  }
  return {};
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
