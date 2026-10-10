/**
 * Read-only triage facts derived from existing risk, evidence, and action records.
 * Does not invent file, line, commit, or cause findings.
 */

export type GovernancePhaseId =
  | "proposed"
  | "approved"
  | "applied_externally"
  | "verified";

export type PhaseState = "complete" | "current" | "upcoming" | "unavailable" | "rejected";

export type GovernancePhase = {
  id: GovernancePhaseId;
  label: string;
  state: PhaseState;
  detail: string;
};

export type CodeCitation = {
  file: string;
  line: string | null;
  commit: string | null;
};

export type CodeInvestigationOutcome =
  | "candidate_cause"
  | "no_cause_found"
  | "insufficient_evidence";

export type CodeInvestigation = {
  outcome: CodeInvestigationOutcome;
  outcomeLabel: string;
  cause: string | null;
  citations: CodeCitation[];
  detail: string;
};

export type UncertaintyReading = {
  confidence: string;
  uncertainty: string;
};

type SignalBag = Record<string, unknown> | null | undefined;

const FILE_KEYS = ["file", "file_path", "path", "source_file", "filename"];
const LINE_KEYS = ["line", "line_number", "lineno"];
const COMMIT_KEYS = ["commit", "commit_sha", "revision", "sha"];
const CAUSE_KEYS = ["candidate_cause", "cause"];
const OUTCOME_KEYS = ["investigation_outcome", "code_investigation_outcome"];

function norm(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function readString(bag: SignalBag, keys: string[]): string | null {
  if (!bag) return null;
  for (const key of keys) {
    const value = bag[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value) && LINE_KEYS.includes(key)) {
      return String(value);
    }
  }
  return null;
}

function citationFrom(bag: SignalBag): CodeCitation | null {
  const file = readString(bag, FILE_KEYS);
  const line = readString(bag, LINE_KEYS);
  const commit = readString(bag, COMMIT_KEYS);
  if (!file || (!line && !commit)) return null;
  return { file, line, commit };
}

function verifiedOutcome(status: string, verification: string): boolean {
  return (
    verification.includes("improvement") ||
    verification.includes("no material") ||
    verification.includes("follow") ||
    verification.includes("rollback") ||
    verification.includes("regression") ||
    status.includes("closed")
  );
}

const APPLIED_DETAIL =
  "External apply not connected. Fleetrac recorded the approved action and verification result, but did not execute or deploy changes.";

/** Proposed, Approved, Applied externally, and Verified stay separate. Approval is never Applied. */
export function governancePhases(
  status: string | null | undefined,
  verificationStatus: string | null | undefined
): GovernancePhase[] {
  const statusText = norm(status);
  const verification = norm(verificationStatus);
  const rejected = statusText.includes("reject");
  const awaiting =
    !statusText || statusText.includes("awaiting") || statusText.includes("pending");
  const applied = statusText.includes("executed") || statusText.includes("applied");
  const verified = !rejected && verifiedOutcome(statusText, verification);
  const approved =
    !rejected &&
    !awaiting &&
    (statusText.includes("approved") ||
      statusText.includes("monitoring") ||
      statusText.includes("rollback") ||
      applied ||
      verified);

  const proposed: GovernancePhase = {
    id: "proposed",
    label: "Proposed",
    state: rejected ? "rejected" : approved || verified ? "complete" : "current",
    detail: rejected
      ? "The governed action was rejected. Rejection does not change agent code."
      : approved || verified
        ? "A governed action was proposed for review."
        : "A governed action is proposed for human review. It is not approved or applied."
  };

  const approvedPhase: GovernancePhase = {
    id: "approved",
    label: "Approved",
    state: rejected || awaiting ? "upcoming" : verified ? "complete" : approved ? "current" : "upcoming",
    detail:
      "Approval records a human decision. It does not apply, deploy, or change agent code."
  };

  const appliedPhase: GovernancePhase = {
    id: "applied_externally",
    label: "Applied externally",
    state: applied ? "complete" : "unavailable",
    detail: applied
      ? "The action record says the change was applied outside Fleetrac. This view did not deploy it."
      : APPLIED_DETAIL
  };

  const verifiedPhase: GovernancePhase = {
    id: "verified",
    label: "Verified",
    state: verified ? "current" : "upcoming",
    detail: verified
      ? `Verification recorded: ${verificationStatus?.trim() || "outcome on file"}.`
      : "Verification has not been recorded. Approval does not count as verification."
  };

  return [proposed, approvedPhase, appliedPhase, verifiedPhase];
}

export function uncertaintyFromConfidence(
  value: string | number | null | undefined
): UncertaintyReading {
  if (value == null || value === "") {
    return {
      confidence: "Not assessed",
      uncertainty: "Unknown. Assessment confidence was not recorded."
    };
  }
  if (typeof value === "number") {
    if (value >= 0.8) {
      return {
        confidence: "High",
        uncertainty: "Limited. The recorded assessment confidence is high."
      };
    }
    if (value >= 0.6) {
      return {
        confidence: "Medium",
        uncertainty: "Moderate. The assessment is not fully settled."
      };
    }
    return {
      confidence: "Low",
      uncertainty:
        "Limited packaged evidence and no connected source repository. This is not a product failure."
    };
  }
  const text = value.toLowerCase();
  if (text.includes("high")) {
    return {
      confidence: "High",
      uncertainty: "Limited. The recorded assessment confidence is high."
    };
  }
  if (text.includes("low")) {
    return {
      confidence: "Low",
      uncertainty:
        "Limited packaged evidence and no connected source repository. This is not a product failure."
    };
  }
  if (text.includes("medium")) {
    return {
      confidence: "Medium",
      uncertainty: "Moderate. The assessment is not fully settled."
    };
  }
  return {
    confidence: "Not assessed",
    uncertainty: "Unknown. Assessment confidence was not recorded."
  };
}

export function codeInvestigationFromSignals(
  signals: SignalBag[]
): CodeInvestigation {
  const citations: CodeCitation[] = [];
  let cause: string | null = null;
  let explicit: string | null = null;

  for (const bag of signals) {
    const citation = citationFrom(bag);
    if (citation) citations.push(citation);
    if (!cause) cause = readString(bag, CAUSE_KEYS);
    if (!explicit) explicit = readString(bag, OUTCOME_KEYS);
  }

  const explicitNorm = norm(explicit);
  if (
    explicitNorm.includes("no cause") ||
    explicitNorm === "no_cause_found" ||
    explicitNorm === "no-cause-found"
  ) {
    return {
      outcome: "no_cause_found",
      outcomeLabel: "No cause found",
      cause: null,
      citations,
      detail: "The record says no code cause was found. Fleetrac did not infer one."
    };
  }

  if (
    (explicitNorm.includes("candidate") || explicitNorm.includes("cause found")) &&
    cause &&
    citations.length > 0
  ) {
    return {
      outcome: "candidate_cause",
      outcomeLabel: "Candidate cause",
      cause,
      citations,
      detail: "A candidate cause is on the record with a file citation. It is not a confirmed fix."
    };
  }

  if (cause && citations.length > 0 && !explicit) {
    return {
      outcome: "candidate_cause",
      outcomeLabel: "Candidate cause",
      cause,
      citations,
      detail: "A candidate cause is on the record with a file citation. It is not a confirmed fix."
    };
  }

  return {
    outcome: "insufficient_evidence",
    outcomeLabel: "Insufficient evidence",
    cause: null,
    citations,
    detail: citations.length
      ? "Citations are on the record, but they do not establish a cause."
      : "Source control is not connected. No file, line, or commit citation is available."
  };
}
