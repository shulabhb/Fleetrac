"use client";

import { useEffect, useRef } from "react";
import { governanceEventsStreamUrl } from "@/lib/governance-api";
import { governanceApiEnabled } from "@/lib/governance-merge";

const FALLBACK_POLL_MS = 5000;

/**
 * Subscribes to governance SSE; invokes onRefresh on message events.
 * Intended for observe-surface updates (live signals + ingest log), not full governance refresh.
 * When the stream errors, falls back to polling onRefresh every 5s.
 */
export function useEventStream(onRefresh: () => void, enabled = true): void {
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;

  useEffect(() => {
    if (!enabled || !governanceApiEnabled()) return;

    let es: EventSource | null = null;
    let fallbackTimer: number | null = null;

    const triggerRefresh = () => {
      refreshRef.current();
    };

    const startFallback = () => {
      if (fallbackTimer !== null) return;
      fallbackTimer = window.setInterval(triggerRefresh, FALLBACK_POLL_MS);
    };

    const stopFallback = () => {
      if (fallbackTimer !== null) {
        window.clearInterval(fallbackTimer);
        fallbackTimer = null;
      }
    };

    try {
      es = new EventSource(governanceEventsStreamUrl());
      es.addEventListener("open", () => {
        stopFallback();
      });
      es.addEventListener("message", () => {
        triggerRefresh();
      });
      es.addEventListener("error", () => {
        es?.close();
        es = null;
        startFallback();
      });
    } catch {
      startFallback();
    }

    return () => {
      stopFallback();
      es?.close();
    };
  }, [enabled]);
}
