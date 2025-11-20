"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { findPhoneNumbersInText, type CountryCode } from "libphonenumber-js";
import { PageFrame, MotionCard, ShimmerTile } from "@/components/ui/LuxuryPrimitives";
import { usePageLoading } from "@/hooks/usePageLoading";
import { RATE_PER_LEAD_CENTS } from "@/lib/flows";
import { normalizePhoneNumber, toDialable } from "@/lib/phone";

type ToastItem = { id: string; message: string; tone?: "info" | "error" | "success" };

function useToast() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((message: string, tone: ToastItem["tone"] = "info") => {
    const id = Math.random().toString(36).slice(2);
    setItems((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }, 2600);
  }, []);
  const View = useCallback(() => {
    return (
      <div className="pointer-events-none fixed right-4 top-4 z-50 flex max-w-sm flex-col gap-2">
        <AnimatePresence>
          {items.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className={`pointer-events-auto rounded-xl px-3 py-2 text-sm text-white shadow-lg ring-1 ring-white/20 ${
                item.tone === "error"
                  ? "bg-rose-500/90"
                  : item.tone === "success"
                  ? "bg-emerald-500/90"
                  : "bg-zinc-900/90"
              }`}
            >
              {item.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    );
  }, [items]);
  return { push, View };
}

type FlowOption = {
  id: string;
  name: string;
  description: string | null;
};

type RouteOption = {
  id: string;
  name: string;
  provider: string;
  domain: string;
  trunkPrefix?: string | null;
  authenticationRequired: boolean;
  isPublic: boolean;
};

type CampaignResponse = {
  campaign: {
    id: string;
    name: string;
    callerId: string;
    route: { id: string; name: string; provider: string };
    callFlow: { id: string; name: string };
    status: string;
    totalLeads: number;
    dialedCount: number;
    connectedCount: number;
    dtmfCount: number;
  };
};

const RATE_PER_LEAD = RATE_PER_LEAD_CENTS / 100;

const PHONE_FRAGMENT_REGEX = /\+?\d[\d\s().-]{6,}\d/g;
const SEGMENT_DELIMITER = /[\n,;]+/;

type ParsedLead = {
  phone: string;
  raw: string;
};

const ICONS = {
  Upload: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
      <path d="M7 9l5-5 5 5" />
      <path d="M12 4v12" />
    </svg>
  ),
  Play: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M8 5v14l11-7-11-7z" />
    </svg>
  ),
  Pause: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  ),
  Stop: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <rect x="5" y="5" width="14" height="14" rx="2" />
    </svg>
  ),
  Save: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
      <path d="M17 21v-8H7v8" />
      <path d="M7 3v5h8" />
    </svg>
  ),
};

function extractPhones(text: string, region: CountryCode = "US"): ParsedLead[] {
  const normalized = new Map<string, string>();
  const detected = findPhoneNumbersInText(text, region);
  for (const match of detected) {
    const e164 = match.number?.number;
    if (e164) {
      const raw = text.slice(match.startsAt ?? 0, match.endsAt ?? 0).trim();
      if (!normalized.has(e164)) {
        normalized.set(e164, raw || e164);
      }
    }
  }
  const segments = text
    .replace(/\r/g, "\n")
    .split(SEGMENT_DELIMITER)
    .map((segment) => segment.trim())
    .filter(Boolean);
  for (const segment of segments) {
    const matches = segment.match(PHONE_FRAGMENT_REGEX) ?? [];
    for (const raw of matches) {
      const e164 = normalizePhoneNumber(raw, region);
      if (e164 && !normalized.has(e164)) {
        normalized.set(e164, segment || raw.trim());
      }
    }
  }
  return Array.from(normalized.entries()).map(([phone, raw]) => ({
    phone,
    raw,
  }));
}

type CampaignState = {
  id: string;
  name: string;
  status: string;
  totals: {
    leads: number;
    dialed: number;
    connected: number;
    dtmf: number;
  };
  routeName: string;
  flowName: string;
};

export default function StartCampaignPage() {
  usePageLoading(520);
  const { push, View: Toasts } = useToast();

  const [flows, setFlows] = useState<FlowOption[]>([]);
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  const [campaignName, setCampaignName] = useState("Autodial Campaign");
  const [callerId, setCallerId] = useState("");
  const [selectedFlow, setSelectedFlow] = useState<string>("");
  const [selectedRoute, setSelectedRoute] = useState<string>("");
    const [callsPerMinute, setCallsPerMinute] = useState(60);
    const [maxConcurrentCalls, setMaxConcurrentCalls] = useState(10);
    const [ringTimeout, setRingTimeout] = useState(45);
    const [description, setDescription] = useState("");

    const [rawLeadText, setRawLeadText] = useState("");
    const [leads, setLeads] = useState<ParsedLead[]>([]);
    const [campaign, setCampaign] = useState<CampaignState | null>(null);
    const [creating, setCreating] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [starting, setStarting] = useState(false);
    const [leadUploadResult, setLeadUploadResult] = useState<number>(0);
    const [skippedLines, setSkippedLines] = useState<number>(0);
    const [dtmfFeed, setDtmfFeed] = useState<any[]>([]);
    const [dtmfFilter, setDtmfFilter] = useState<string | null>(null);
    const [dtmfLoading, setDtmfLoading] = useState(false);
    const [amdEnabled, setAmdEnabled] = useState(false);
    const [voicemailRetryLimit, setVoicemailRetryLimit] = useState(0);

  const loadOptions = useCallback(async () => {
    try {
      setLoadingOptions(true);
      const [flowRes, routeRes] = await Promise.all([
        fetch("/api/flows", { cache: "no-store" }),
        fetch("/api/routes?status=active", { cache: "no-store" }),
      ]);
      if (!flowRes.ok) {
        const data = await flowRes.json().catch(() => null);
        throw new Error(data?.error ?? "Unable to load flows");
      }
      if (!routeRes.ok) {
        const data = await routeRes.json().catch(() => null);
        throw new Error(data?.error ?? "Unable to load routes");
      }
      const flowData = await flowRes.json();
      const routeData = await routeRes.json();
      const flowOptions: FlowOption[] = (flowData.flows ?? []).map((flow: any) => ({
        id: flow.id,
        name: flow.name,
        description: flow.description ?? "",
      }));
      const routeOptions: RouteOption[] = (routeData.routes ?? []).map((route: any) => ({
        id: route.id,
        name: route.name,
        provider: route.provider,
        domain: route.domain,
        trunkPrefix: route.trunkPrefix ?? null,
        authenticationRequired: route.authenticationRequired,
        isPublic: route.isPublic,
      }));
      setFlows(flowOptions);
      setRoutes(routeOptions);
      if (!selectedFlow && flowOptions.length) setSelectedFlow(flowOptions[0].id);
      if (!selectedRoute && routeOptions.length) setSelectedRoute(routeOptions[0].id);
    } catch (error: any) {
      push(error?.message ?? "Unable to load options", "error");
    } finally {
      setLoadingOptions(false);
    }
  }, [push, selectedFlow, selectedRoute]);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    const parsed = extractPhones(rawLeadText);
    setLeads(parsed);
  }, [rawLeadText]);

    useEffect(() => {
      if (!campaign?.id) {
        setDtmfFeed([]);
        return;
      }
      let active = true;
      let initial = true;
      async function load() {
        if (initial) setDtmfLoading(true);
        try {
          const params = new URLSearchParams({ dtmfOnly: "true", limit: "25" });
          const res = await fetch(`/api/campaigns/${campaign.id}/calls?${params.toString()}`, {
            cache: "no-store",
          });
          if (!res.ok) {
            return;
          }
          const data = await res.json().catch(() => null);
          if (active) {
            setDtmfFeed(data?.calls ?? []);
          }
        } finally {
          if (initial && active) {
            setDtmfLoading(false);
            initial = false;
          }
        }
      }
      load();
      const timer = setInterval(load, 6000);
      return () => {
        active = false;
        clearInterval(timer);
      };
    }, [campaign?.id]);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      setRawLeadText(text);
      const parsed = extractPhones(text);
      push(`Parsed ${parsed.length} leads`, "success");
    };
    reader.readAsText(file);
  }, [push]);

    const totalCost = useMemo(() => leads.length * RATE_PER_LEAD, [leads.length]);

    const selectedRouteMeta = useMemo(
      () => routes.find((route) => route.id === selectedRoute) ?? null,
      [routes, selectedRoute]
    );

    const dialPreview = useMemo(() => {
      if (!selectedRouteMeta || leads.length === 0) return null;
      return toDialable(leads[0].phone, selectedRouteMeta.trunkPrefix ?? undefined);
    }, [selectedRouteMeta, leads]);

    const dtmfResponses = useMemo(() => {
      if (!dtmfFeed.length) return [];
      if (!dtmfFilter) return dtmfFeed;
      return dtmfFeed.filter((item) => item.dtmf?.startsWith(dtmfFilter));
    }, [dtmfFeed, dtmfFilter]);

  const handleCreateCampaign = useCallback(async () => {
    if (!selectedFlow || !selectedRoute) {
      push("Select a route and a flow", "error");
      return;
    }
    try {
      setCreating(true);
      const payload = {
        name: campaignName.trim() || "Autodial Campaign",
        description: description.trim() || undefined,
        callFlowId: selectedFlow,
        routeId: selectedRoute,
        callerId: callerId.trim(),
        callsPerMinute,
        maxConcurrentCalls,
        ringTimeoutSeconds: ringTimeout,
          amdEnabled,
          voicemailRetryLimit: Math.max(0, Number.isFinite(voicemailRetryLimit) ? voicemailRetryLimit : 0),
      };
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Unable to create campaign");
      }
      const data: CampaignResponse = await res.json();
      const result = data.campaign;
      setCampaign({
        id: result.id,
        name: result.name,
        status: result.status,
        routeName: result.route.name,
        flowName: result.callFlow.name,
        totals: {
          leads: result.totalLeads,
          dialed: result.dialedCount,
          connected: result.connectedCount,
          dtmf: result.dtmfCount,
        },
      });
      push("Campaign created", "success");
    } catch (error: any) {
      push(error?.message ?? "Unable to create campaign", "error");
    } finally {
      setCreating(false);
    }
  }, [
    selectedFlow,
    selectedRoute,
    campaignName,
    description,
    callerId,
    callsPerMinute,
    maxConcurrentCalls,
    ringTimeout,
      amdEnabled,
      voicemailRetryLimit,
    push,
  ]);

  const handleUploadLeads = useCallback(async () => {
    if (!campaign) {
      push("Create a campaign first", "error");
      return;
    }
    if (leads.length === 0) {
      push("No leads to upload", "error");
      return;
    }
    try {
        setUploading(true);
        const payload = {
          leads: leads.map((lead) => ({ phone: lead.phone, raw: lead.raw })),
          country: "US",
        };
      const res = await fetch(`/api/campaigns/${campaign.id}/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Unable to upload leads");
      }
        const data = await res.json();
        const inserted = data.inserted ?? 0;
        const skipped = data.skipped ?? 0;
        setLeadUploadResult(inserted);
        setSkippedLines(skipped);
        const suffix = skipped > 0 ? ` · skipped ${skipped} pressed-1 lines` : "";
        push(`Uploaded ${inserted} leads${suffix}`, "success");
    } catch (error: any) {
      push(error?.message ?? "Unable to upload leads", "error");
    } finally {
      setUploading(false);
    }
  }, [campaign, leads, push]);

  const handleStartCampaign = useCallback(async () => {
    if (!campaign) return;
    try {
      setStarting(true);
      const res = await fetch(`/api/campaigns/${campaign.id}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? "Unable to start campaign");
      }
      push("Campaign started", "success");
      setCampaign((current) =>
        current ? { ...current, status: "running" } : current
      );
    } catch (error: any) {
      push(error?.message ?? "Unable to start campaign", "error");
    } finally {
      setStarting(false);
    }
  }, [campaign, push]);

  const resetState = useCallback(() => {
    setCampaign(null);
    setLeadUploadResult(0);
      setSkippedLines(0);
    setLeads([]);
    setRawLeadText("");
      setAmdEnabled(false);
      setVoicemailRetryLimit(0);
    push("Ready to create another campaign", "info");
  }, [push]);

  const campaignReady = Boolean(campaign);
  const leadsUploaded = leadUploadResult > 0;

  return (
    <PageFrame
      eyebrow="Campaigns"
      title="Campaign command console"
      description="Configure your target flow, assign a route, upload leads, and launch outbound calls with confidence."
    >
      <Toasts />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <MotionCard tone="neutral" className="p-6">
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Campaign name
              </label>
              <input
                value={campaignName}
                onChange={(event) => setCampaignName(event.target.value)}
                className="mt-1 w-full rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40 dark:border-white/10 dark:bg-white/5 dark:text-white"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Caller ID (E.164)
                </label>
                <input
                  value={callerId}
                  onChange={(event) => setCallerId(event.target.value)}
                  placeholder="+12125550123"
                  className="mt-1 w-full rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40 dark:border-white/10 dark:bg-white/5 dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Route
                </label>
                <select
                  value={selectedRoute}
                  onChange={(event) => setSelectedRoute(event.target.value)}
                  disabled={loadingOptions}
                  className="mt-1 w-full rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40 dark:border-white/10 dark:bg-white/5 dark:text-white"
                >
                  {routes.map((route) => (
                    <option key={route.id} value={route.id}>
                      {route.name} · {route.provider}
                      {route.trunkPrefix ? ` · prefix ${route.trunkPrefix}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Flow
              </label>
              <select
                value={selectedFlow}
                onChange={(event) => setSelectedFlow(event.target.value)}
                disabled={loadingOptions}
                className="mt-1 w-full rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40 dark:border-white/10 dark:bg-white/5 dark:text-white"
              >
                {flows.map((flow) => (
                  <option key={flow.id} value={flow.id}>
                    {flow.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Description
              </label>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                className="mt-1 w-full rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40 dark:border-white/10 dark:bg-white/5 dark:text-white"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Calls per minute
                </label>
                <input
                  type="number"
                  value={callsPerMinute}
                  min={1}
                  max={600}
                  onChange={(event) => setCallsPerMinute(Number(event.target.value))}
                  className="mt-1 w-full rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40 dark:border-white/10 dark:bg-white/5 dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Max concurrent calls
                </label>
                <input
                  type="number"
                  value={maxConcurrentCalls}
                  min={1}
                  max={200}
                  onChange={(event) => setMaxConcurrentCalls(Number(event.target.value))}
                  className="mt-1 w-full rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40 dark:border-white/10 dark:bg-white/5 dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Ring timeout (seconds)
                </label>
                <input
                  type="number"
                  value={ringTimeout}
                  min={10}
                  max={120}
                  onChange={(event) => setRingTimeout(Number(event.target.value))}
                  className="mt-1 w-full rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40 dark:border-white/10 dark:bg-white/5 dark:text-white"
                />
              </div>
            </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex items-center gap-3 rounded-2xl border border-white/60 bg-white/70 px-4 py-3 text-sm text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200">
                  <input
                    type="checkbox"
                    checked={amdEnabled}
                    onChange={(event) => setAmdEnabled(event.target.checked)}
                    className="h-4 w-4 accent-emerald-500"
                  />
                  Enable answering machine detection
                </label>
                <div>
                  <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Voicemail retry count
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={5}
                    value={voicemailRetryLimit}
                    disabled={!amdEnabled}
                    onChange={(event) => setVoicemailRetryLimit(Number(event.target.value))}
                    className="mt-1 w-full rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-white"
                  />
                </div>
              </div>

            <div className="rounded-2xl border border-white/60 bg-white/60 p-4 dark:border-white/10 dark:bg-white/5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                    Leads
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    Paste numbers, upload a file, or enter manually.
                  </div>
                </div>
                <label className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/70 px-3 py-1.5 text-xs text-zinc-600 transition hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10">
                  <ICONS.Upload className="h-4 w-4" />
                  Upload file
                  <input
                    type="file"
                    accept=".txt,.csv,.tsv,.log,.md"
                    hidden
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) handleFile(file);
                      event.target.value = "";
                    }}
                  />
                </label>
              </div>

                <textarea
                  value={rawLeadText}
                  onChange={(event) => setRawLeadText(event.target.value)}
                  rows={8}
                  placeholder="Paste phone numbers or free-form text, we'll extract valid MSISDNs automatically."
                  className="mt-3 w-full rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40 dark:border-white/10 dark:bg-white/5 dark:text-white"
                />

                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                  <span>{leads.length} deduplicated leads</span>
                  <span>Cost preview: ${totalCost.toFixed(2)} @ ${RATE_PER_LEAD.toFixed(2)} per lead</span>
                  {dialPreview ? <span>Dial preview: {dialPreview}</span> : null}
                </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <button
                onClick={handleCreateCampaign}
                disabled={creating}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <ICONS.Save className="h-4 w-4" />
                {creating ? "Creating..." : "Create campaign"}
              </button>
              <button
                onClick={handleUploadLeads}
                disabled={!campaignReady || uploading || leads.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/60 bg-white/70 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
              >
                <ICONS.Upload className="h-4 w-4" />
                {uploading ? "Uploading..." : "Upload leads"}
              </button>
              <button
                onClick={handleStartCampaign}
                disabled={!campaignReady || !leadsUploaded || starting}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <ICONS.Play className="h-4 w-4" />
                {starting ? "Starting..." : "Start campaign"}
              </button>
            </div>

            <button
              onClick={resetState}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/60 bg-white/60 px-4 py-2 text-sm text-zinc-600 transition hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
            >
              Reset
            </button>
          </div>
        </MotionCard>

        <MotionCard tone="neutral" className="p-6">
          {campaign ? (
            <div className="space-y-4">
              <div>
                <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                  Campaign status
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  #{campaign.id}
                </div>
              </div>
              <div className="grid gap-3 text-sm text-zinc-600 dark:text-zinc-300">
                <div className="flex items-center justify-between">
                  <span>Status</span>
                  <span className="font-semibold capitalize">{campaign.status}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Route</span>
                  <span>{campaign.routeName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Flow</span>
                  <span>{campaign.flowName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Leads uploaded</span>
                  <span>{leadUploadResult}</span>
                </div>
                  <div className="flex items-center justify-between">
                    <span>Pressed 1 skipped</span>
                    <span>{skippedLines}</span>
                  </div>
                <div className="flex items-center justify-between">
                  <span>Total cost (est.)</span>
                  <span>${(leadUploadResult * RATE_PER_LEAD).toFixed(2)}</span>
                </div>
              </div>
              <div className="rounded-2xl border border-white/60 bg-white/60 p-4 dark:border-white/10 dark:bg-white/5">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                  Performance
                </div>
                <div className="mt-3 grid gap-2 text-xs text-zinc-600 dark:text-zinc-300">
                  <span>Dialed: {campaign.totals.dialed}</span>
                  <span>Connected: {campaign.totals.connected}</span>
                  <span>DTMF: {campaign.totals.dtmf}</span>
                </div>
              </div>
                <div className="rounded-2xl border border-white/60 bg-white/60 p-4 dark:border-white/10 dark:bg-white/5">
                  <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                    <span>DTMF responses</span>
                    <button
                      onClick={() => setDtmfFilter((current) => (current === "1" ? null : "1"))}
                      className="rounded-full border border-emerald-400/40 px-3 py-1 text-[10px] font-semibold text-emerald-600 transition hover:bg-emerald-500/10 dark:text-emerald-300"
                    >
                      {dtmfFilter === "1" ? "Clear filter" : "Pressed 1"}
                    </button>
                  </div>
                  {dtmfLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, index) => (
                        <ShimmerTile key={index} className="h-12 rounded-xl" />
                      ))}
                    </div>
                  ) : dtmfResponses.length === 0 ? (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">No digits captured yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {dtmfResponses.slice(0, 5).map((entry) => (
                        <div key={entry.id} className="rounded-xl border border-white/50 bg-white/70 p-3 text-sm dark:border-white/10 dark:bg-white/5">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-zinc-700 dark:text-zinc-200">
                              {entry.lead?.phoneNumber ?? entry.dialedNumber ?? "Unknown"}
                            </span>
                            <span className="font-mono text-xs text-emerald-500 dark:text-emerald-300">{entry.dtmf}</span>
                          </div>
                          <div className="text-xs text-zinc-500 dark:text-zinc-400">
                            {new Date(entry.createdAt).toLocaleTimeString()}
                          </div>
                            {entry.lead?.rawLine ? (
                              <p className="mt-2 whitespace-pre-wrap break-words text-xs text-zinc-600 dark:text-zinc-300">
                                {entry.lead.rawLine}
                              </p>
                            ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/60 bg-white/60 p-6 text-sm text-zinc-500 dark:border-white/10 dark:bg-white/5 dark:text-zinc-400">
              Campaign metrics will appear once you create a campaign.
            </div>
          )}
        </MotionCard>
      </div>
    </PageFrame>
  );
}
