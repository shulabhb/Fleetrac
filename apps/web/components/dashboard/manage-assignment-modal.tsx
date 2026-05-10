"use client";

import { useEffect, useState } from "react";
import type { OwnerInsight, OwnerTeamDetails } from "@/lib/governance-dashboard-mock";

export type AssignmentSavePayload = {
  teamLead: string;
  members: string[];
  dueDate: string;
  note: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  details: OwnerTeamDetails;
  insight: OwnerInsight;
  /** Current assignments (may include dashboard overrides). */
  assignedMembers: string[];
  teamLead: string;
  onSave: (payload: AssignmentSavePayload) => void;
  onResendNotification?: () => void;
};

const DUE_OPTIONS = [
  { value: "24h", label: "24 hours" },
  { value: "48h", label: "48 hours" },
  { value: "7d", label: "7 days" },
  { value: "14d", label: "14 days" }
];

export function ManageAssignmentModal({
  open,
  onClose,
  details,
  insight,
  assignedMembers,
  teamLead,
  onSave,
  onResendNotification
}: Props) {
  const [lead, setLead] = useState(teamLead);
  const [membersPick, setMembersPick] = useState<string[]>(assignedMembers);
  const [due, setDue] = useState("48h");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    setLead(teamLead);
    setMembersPick(assignedMembers);
    setDue("48h");
    setNote("");
  }, [open, teamLead, assignedMembers]);

  if (!open) return null;

  const reviewerPool = details.members;

  const toggleMember = (name: string) => {
    setMembersPick((prev) =>
      prev.includes(name) ? prev.filter((m) => m !== name) : [...prev, name]
    );
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/35 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="manage-assignment-title"
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-auto rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 id="manage-assignment-title" className="text-sm font-semibold text-slate-900">
            Manage assignment
          </h2>
        </div>
        <div className="space-y-3 px-4 py-3 text-[13px] text-slate-700">
          <p>
            <span className="text-slate-500">Owner team:</span>{" "}
            <span className="font-medium text-slate-900">{details.teamName}</span>
          </p>
          <p>
            <span className="text-slate-500">Team lead:</span>{" "}
            <span className="font-medium text-slate-900">{teamLead}</span>
          </p>
          <p>
            <span className="text-slate-500">Queue:</span>{" "}
            <span className="font-medium tabular-nums text-slate-900">
              {insight.decisionsNeeded} decisions waiting
            </span>
          </p>
          <p>
            <span className="text-slate-500">Evidence pack:</span>{" "}
            <span className="font-medium text-slate-900">{details.evidencePackStatus}</span>
          </p>
          <p>
            <span className="text-slate-500">Last notified:</span>{" "}
            <span className="font-medium text-slate-900">{details.lastNotifiedAt}</span>
          </p>

          <label className="block pt-1">
            <span className="text-[11px] font-medium text-slate-600">Team lead</span>
            <select
              value={lead}
              onChange={(e) => setLead(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[13px] text-slate-900 shadow-sm"
            >
              <option value={details.teamLead}>{details.teamLead}</option>
              {details.teamLead !== teamLead ? (
                <option value={teamLead}>{teamLead}</option>
              ) : null}
            </select>
          </label>

          <fieldset className="space-y-1.5">
            <legend className="text-[11px] font-medium text-slate-600">Assigned reviewers</legend>
            <div className="flex flex-wrap gap-2">
              {reviewerPool.map((m) => (
                <label
                  key={m}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[12px]"
                >
                  <input
                    type="checkbox"
                    checked={membersPick.includes(m)}
                    onChange={() => toggleMember(m)}
                    className="rounded border-slate-300 text-slate-900"
                  />
                  {m}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="block">
            <span className="text-[11px] font-medium text-slate-600">Due date</span>
            <select
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[13px] text-slate-900 shadow-sm"
            >
              {DUE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[11px] font-medium text-slate-600">Note (optional)</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-[13px] text-slate-900 shadow-sm"
              placeholder="Context for reviewers…"
            />
          </label>

          {onResendNotification ? (
            <button
              type="button"
              onClick={onResendNotification}
              className="text-[12px] font-medium text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
            >
              Resend notification to team lead
            </button>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onSave({ teamLead: lead, members: membersPick, dueDate: due, note });
              onClose();
            }}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-slate-800"
          >
            Save assignment
          </button>
        </div>
      </div>
    </div>
  );
}
