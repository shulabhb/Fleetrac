import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatRelativeTime, parseApiTimestamp } from "./format.ts";

function naiveUtc(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "");
}

describe("API timestamps", () => {
  it("reads a timezone-less timestamp as UTC", () => {
    const parsed = parseApiTimestamp("2026-10-10T18:52:54");
    assert.equal(parsed.toISOString(), "2026-10-10T18:52:54.000Z");
    assert.equal(parseApiTimestamp("2026-10-10 18:52:54").toISOString(), "2026-10-10T18:52:54.000Z");
  });

  it("does not render a just-recorded UTC action as 7h ago", () => {
    assert.equal(formatRelativeTime(naiveUtc(new Date())), "just now");
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    assert.equal(formatRelativeTime(naiveUtc(fiveMinutesAgo)), "5m ago");
  });
});
