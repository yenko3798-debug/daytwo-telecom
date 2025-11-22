import useSWR from "swr";

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

const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const message = (await res.json().catch(() => null))?.error ?? "Unable to load metrics";
    throw new Error(message);
  }
  return (await res.json()) as LiveMetrics;
};

export function useLiveMetrics({ scope = "me", rangeHours = 24, intervalMs = 6000 }: Options = {}) {
  const params = new URLSearchParams({
    scope,
    range: String(rangeHours),
  });
  const key = `/api/metrics/live?${params.toString()}`;
  const { data, error, isLoading } = useSWR(key, fetcher, {
    refreshInterval: intervalMs,
    revalidateOnFocus: false,
    keepPreviousData: true,
  });

  return {
    data: data ?? null,
    loading: !data && !error && isLoading,
    error: error?.message ?? null,
  };
}
