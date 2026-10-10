"use client";

import { useEffect, useState } from "react";
import type { Integration } from "@/lib/operations-types";
import { Badge } from "@/components/ui/badge";
import { IntegrationProviderMark } from "@/components/operations/integration-provider-mark";
import {
  MODEL_PROFILES,
  defaultPreference,
  loadPreferences,
  preferenceFor,
  savePreference,
  type ModelPreference
} from "@/lib/fleet-model-profile";

const IN_USE_PROVIDERS = [
  {
    id: "int_bedrock",
    providerKey: "bedrock",
    agents: "Access Review · Internal Knowledge RAG"
  },
  {
    id: "int_azure_openai",
    providerKey: "azure",
    agents: "Phishing Triage · Customer Support Routing"
  },
  {
    id: "int_vertex",
    providerKey: "vertex",
    agents: "Treasury Commentary"
  }
] as const;

function connectionTone(
  status: Integration["connection_status"] | undefined
): "low" | "medium" | "high" | "neutral" {
  if (status === "connected") return "low";
  if (status === "degraded") return "medium";
  if (status === "disconnected" || status === "needs_auth") return "high";
  return "neutral";
}

export function SettingsInUse({ integrations }: { integrations: Integration[] }) {
  const byId = new Map(integrations.map((item) => [item.id, item]));
  const providers = IN_USE_PROVIDERS.map((row) => ({
    ...row,
    record: byId.get(row.id)
  }));
  const [prefs, setPrefs] = useState<Record<string, ModelPreference>>({});
  const [repoDraft, setRepoDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    const stored = loadPreferences();
    setPrefs(stored);
    const drafts: Record<string, string> = {};
    for (const profile of MODEL_PROFILES) {
      drafts[profile.systemId] = preferenceFor(profile.systemId, stored)?.repository ?? "";
    }
    setRepoDraft(drafts);
  }, []);

  const update = (systemId: string, next: ModelPreference) => {
    savePreference(systemId, next);
    setPrefs(loadPreferences());
  };

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-[15px] font-bold text-slate-950">Model providers</h2>
          <p className="mt-0.5 text-[12px] text-slate-500">
            Providers used by the governed agents in this workspace.
          </p>
        </div>
        <ul className="divide-y divide-slate-100">
          {providers.map((provider) => (
            <li key={provider.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <IntegrationProviderMark
                  integrationId={provider.id}
                  providerKey={provider.providerKey}
                />
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-slate-950">
                    {provider.record?.provider ?? provider.id}
                  </p>
                  <p className="mt-0.5 text-[12px] text-slate-500">{provider.agents}</p>
                </div>
              </div>
              <Badge tone={connectionTone(provider.record?.connection_status)} size="xs">
                {(provider.record?.connection_status ?? "not connected").replace(/_/g, " ")}
              </Badge>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-[15px] font-bold text-slate-950">Models</h2>
          <p className="mt-0.5 text-[12px] text-slate-500">
            Choose what each model tracks. Telemetry channels already on the agent can be included
            together. A repository name stays in this browser and does not connect source control.
          </p>
        </div>
        <ul className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {MODEL_PROFILES.map((profile) => {
            const preference = preferenceFor(profile.systemId, prefs) ?? defaultPreference(profile);
            const toggle = (key: "trackedControls" | "enabledChannels", id: string) => {
              const current = preference[key];
              const nextValues = current.includes(id)
                ? current.filter((item) => item !== id)
                : [...current, id];
              update(profile.systemId, { ...preference, [key]: nextValues });
            };
            return (
              <li key={profile.systemId} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-start gap-3">
                  <IntegrationProviderMark
                    integrationId={profile.integrationId}
                    providerKey={profile.providerKey}
                  />
                  <div>
                    <p className="text-[14px] font-semibold text-slate-950">
                      {profileLabel(profile.systemId)}
                    </p>
                    <p className="text-[12px] text-slate-500">{profile.provider}</p>
                  </div>
                </div>

                <fieldset className="mt-3">
                  <legend className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Telemetry to include
                  </legend>
                  <ul className="mt-1 space-y-1">
                    {profile.channels.map((channel) => (
                      <li key={channel.id}>
                        <label className="flex items-center gap-2 text-[12px] text-slate-700">
                          <input
                            type="checkbox"
                            checked={preference.enabledChannels.includes(channel.id)}
                            onChange={() => toggle("enabledChannels", channel.id)}
                          />
                          {channel.label}
                        </label>
                      </li>
                    ))}
                  </ul>
                </fieldset>

                <fieldset className="mt-3">
                  <legend className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    What to track
                  </legend>
                  <ul className="mt-1 space-y-1">
                    {profile.controls.map((control) => (
                      <li key={control.id}>
                        <label className="flex items-center gap-2 text-[12px] text-slate-700">
                          <input
                            type="checkbox"
                            checked={preference.trackedControls.includes(control.id)}
                            onChange={() => toggle("trackedControls", control.id)}
                          />
                          {control.label}
                        </label>
                      </li>
                    ))}
                  </ul>
                </fieldset>

                <form
                  className="mt-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    update(profile.systemId, {
                      ...preference,
                      repository: (repoDraft[profile.systemId] ?? "").trim()
                    });
                  }}
                >
                  <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Source repository
                  </label>
                  <div className="mt-1 flex gap-2">
                    <input
                      value={repoDraft[profile.systemId] ?? ""}
                      onChange={(event) =>
                        setRepoDraft((current) => ({
                          ...current,
                          [profile.systemId]: event.target.value
                        }))
                      }
                      placeholder="Not connected"
                      className="h-8 min-w-0 flex-1 rounded-md border border-slate-200 px-2 text-[12px]"
                    />
                    <button
                      type="submit"
                      className="rounded-md bg-emerald-700 px-2.5 text-[12px] font-semibold text-white hover:bg-emerald-800"
                    >
                      Save
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {preference.repository.trim()
                      ? `${preference.repository.trim()} is recorded locally. Source control is not connected.`
                      : "Not connected."}
                  </p>
                </form>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function profileLabel(systemId: string): string {
  switch (systemId) {
    case "sys-agt-treasury-001":
      return "Treasury Commentary";
    case "sys-agt-phish-008":
      return "Phishing Triage";
    case "sys-agt-cs-002":
      return "Customer Support Routing";
    case "sys-agt-rag-007":
      return "Internal Knowledge RAG";
    case "sys-agt-access-009":
      return "Access Review";
    default:
      return systemId;
  }
}
