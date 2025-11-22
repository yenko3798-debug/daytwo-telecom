import { useEffect, useState } from "react";

export type LiveMetrics = {
  timestamp: string;
  scope: string;
  rangeHours: number;
  campaigns: {
    total: number;
    running: number;
    paused: number;
    completed: number;
  };
  calls: {
    total: number;
    answered: number;
    failed: number;
    dtmf: number;
      voicemail: number;
    costCents: number;
  };
  leads: {
    total: number;
    dialed: number;
    connected: number;
    dtmf: number;
  };
  activeCalls: number;
  cps: number;
  dtmfBreakdown: Array<{ digit: string; count: number }>;
  feed: Array<{
    id: string;
    status: string;
    callerId: string | null;
    dialedNumber: string | null;
    dtmf: string | null;
    durationSeconds: number;
    costCents: number;
    createdAt: string;
      voicemailStatus?: string;
    campaign: { id: string; name: string };
    lead: {
      phoneNumber: string | null;
      normalizedNumber: string | null;
      rawLine: string | null;
    } | null;
  }>;
};

type Options = {
  scope?: "me" | "public" | "admin";
  rangeHours?: number;
  intervalMs?: number;
};

export function useLiveMetrics({ scope = "me", rangeHours = 24, intervalMs = 6000 }: Options = {}) {
  const [data, setData] = useState<LiveMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const controllers = new Set<AbortController>();

    async function load() {
      const controller = new AbortController();
      controllers.add(controller);
      try {
        const params = new URLSearchParams({
          scope,
          range: String(rangeHours),
        });
        const res = await fetch(`/api/metrics/live?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) {
          const message = (await res.json().catch(() => null))?.error ?? "Unable to load metrics";
          throw new Error(message);
        }
        const json = (await res.json()) as LiveMetrics;
        if (active) {
          setData(json);
          setLoading(false);
          setError(null);
        }
      } catch (err: any) {
        if (controller.signal.aborted) return;
        if (active) {
          setError(err?.message ?? "Unable to load metrics");
          setLoading(false);
        }
      } finally {
        controllers.delete(controller);
      }
    }

    load();
    const timer = setInterval(load, intervalMs);
    return () => {
      active = false;
      controllers.forEach((controller) => controller.abort());
      controllers.clear();
      clearInterval(timer);
    };
  }, [scope, rangeHours, intervalMs]);

  return { data, loading, error };
}
