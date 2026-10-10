"use client";

/**
 * Default evidence view for mixed audiences.
 * Raw JSON stays behind "show more".
 */

export function PlainLanguageEvidence({
  noticed,
  whyItMatters,
  compared,
  snippet,
  recommendation,
  raw
}: {
  noticed: string;
  whyItMatters: string;
  compared?: string | null;
  snippet: string[];
  recommendation?: string | null;
  raw?: string | null;
}) {
  const lines = snippet.map((line) => line.trim()).filter(Boolean).slice(0, 12);
  return (
    <section className="rounded-md border border-slate-200 bg-slate-50/70 px-3 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        In plain language
      </p>
      <dl className="mt-2 space-y-2 text-[13px] leading-snug text-slate-800">
        <div>
          <dt className="text-[11px] font-medium text-slate-500">What we noticed</dt>
          <dd>{noticed}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium text-slate-500">Why it matters</dt>
          <dd>{whyItMatters}</dd>
        </div>
        {compared ? (
          <div>
            <dt className="text-[11px] font-medium text-slate-500">What we compared</dt>
            <dd>{compared}</dd>
          </div>
        ) : null}
        {recommendation ? (
          <div>
            <dt className="text-[11px] font-medium text-slate-500">What we recommend</dt>
            <dd>{recommendation}</dd>
          </div>
        ) : null}
      </dl>
      {lines.length ? (
        <pre className="mt-3 overflow-x-auto rounded-md border border-slate-200 bg-white px-3 py-2 text-[11px] leading-relaxed text-slate-700">
          {lines.join("\n")}
        </pre>
      ) : null}
      {raw ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-[11px] font-medium text-slate-600">
            Show raw log
          </summary>
          <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-slate-900 px-3 py-2 text-[10px] text-slate-100">
            {raw}
          </pre>
        </details>
      ) : null}
      <p className="mt-2 text-[11px] text-slate-500">
        Fleetrac records what it saw. It does not change agent code.
      </p>
    </section>
  );
}
