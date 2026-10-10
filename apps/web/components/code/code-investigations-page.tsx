"use client";

import { useEffect, useState } from "react";
import { GovernancePageShell } from "@/components/layout/governance-page-shell";
import { fetchGovernanceSystems, type GovernanceSystemDTO } from "@/lib/governance-api";

const API = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:8000";

export function CodeInvestigationsPage() {
  const [systems, setSystems] = useState<GovernanceSystemDTO[]>([]);
  const [systemId, setSystemId] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [hits, setHits] = useState<{ path: string; line: number; text: string; note: string }[]>([]);

  const load = async () => {
    const data = await fetchGovernanceSystems();
    setSystems(data?.items ?? []);
  };

  useEffect(() => {
    void load();
  }, []);

  const connect = async () => {
    if (!systemId || !repoUrl.trim()) {
      setNote("Choose an agent and paste a public https repository URL.");
      return;
    }
    setNote("Connecting…");
    const res = await fetch(`${API}/api/v1/governance/systems/${encodeURIComponent(systemId)}/repository`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repo_url: repoUrl.trim(), repo_ref: "main" })
    });
    setNote(res.ok ? "Repository connected. This is read-only." : "Could not connect that public URL.");
    setRepoUrl("");
    await load();
  };

  const look = async (id: string) => {
    setHits([]);
    const res = await fetch(
      `${API}/api/v1/governance/systems/${encodeURIComponent(id)}/code-search?terms=timeout,allow,tool,prompt`
    );
    if (!res.ok) {
      setNote("No connected repository for that agent yet.");
      return;
    }
    const data = (await res.json()) as { hits: typeof hits };
    setHits(data.hits ?? []);
    setNote(data.hits?.length ? "Citations are a hypothesis, not a fix." : "Nothing in the repo matched those words.");
  };

  const connected = systems.filter((s) => s.code_status === "connected");

  return (
    <GovernancePageShell
      loop="investigate"
      eyebrow="Optional · Code"
      title="Code Investigations"
      subtitle="Connect a public repository if you want a cited guess. You can finish governance without this."
      workflowLine="Fleetrac does not commit, open a pull request, or change the agent."
    >
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {connected.length ? "Connected repositories" : "Nothing connected yet"}
        </h2>
        {connected.length ? (
          <ul className="mt-2 space-y-2">
            {connected.map((system) => (
              <li key={system.system_id} className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
                <span>
                  <span className="font-medium text-slate-900">{system.system_name}</span>
                  <span className="text-slate-500"> · {system.repo_url}</span>
                  <span className="text-slate-400"> · {system.code_status}</span>
                </span>
                <button
                  type="button"
                  onClick={() => void look(system.system_id)}
                  className="rounded-md border border-slate-200 px-2 py-1 font-medium text-slate-800"
                >
                  Look for a possible cause
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[13px] text-slate-600">
            Connect a public git URL for any governed agent. Private repositories are not supported yet.
          </p>
        )}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <select
            value={systemId}
            onChange={(e) => setSystemId(e.target.value)}
            className="h-9 rounded-md border border-slate-200 px-2 text-[12px]"
          >
            <option value="">Choose an agent</option>
            {systems.map((system) => (
              <option key={system.system_id} value={system.system_id}>
                {system.system_name}
                {system.code_status === "connected" ? " (connected)" : ""}
              </option>
            ))}
          </select>
          <input
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/org/agent"
            className="h-9 flex-1 rounded-md border border-slate-200 px-2 text-[12px]"
          />
          <button
            type="button"
            onClick={() => void connect()}
            className="h-9 rounded-md bg-slate-900 px-3 text-[12px] font-semibold text-white"
          >
            Connect repository
          </button>
        </div>
        {note ? <p className="mt-2 text-[12px] text-slate-600">{note}</p> : null}
        {hits.length ? (
          <ul className="mt-3 space-y-2">
            {hits.map((hit) => (
              <li key={`${hit.path}:${hit.line}`} className="rounded-md border border-slate-100 px-3 py-2 text-[12px]">
                <p className="font-mono text-[11px] text-slate-500">
                  {hit.path}:{hit.line}
                </p>
                <p className="mt-1 text-slate-800">{hit.text}</p>
                <p className="mt-1 text-[11px] text-slate-500">{hit.note}</p>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </GovernancePageShell>
  );
}
