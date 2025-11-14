"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageFrame, MotionCard, ShimmerTile } from "@/components/ui/LuxuryPrimitives";
import { usePageLoading } from "@/hooks/usePageLoading";
import { AnimatePresence, motion } from "framer-motion";

const Icons = {
  Refresh: (props: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M20 12a8 8 0 10-3 6.3" />
      <path d="M20 4v6h-6" />
    </svg>
  ),
  Plus: (props: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  Save: (props: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
      <path d="M17 21v-8H7v8" />
      <path d="M7 3v5h8" />
    </svg>
  ),
  Play: (props: any) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M8 5v14l11-7-11-7z" />
    </svg>
  ),
  Pause: (props: any) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  ),
  Stop: (props: any) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  ),
  ArrowRight: (props: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M5 12h14" />
      <path d="M13 5l7 7-7 7" />
    </svg>
  ),
};

type DashboardStats = {
  users: number;
  campaigns: { total: number; running: number; paused: number; completed: number };
  leads: number;
  activeCalls: number;
  volumeCents: number;
};

type RouteItem = {
  id: string;
  name: string;
  provider: string;
  domain: string;
  outboundUri: string | null;
  trunkPrefix: string | null;
  callerIdFormat: string | null;
  maxChannels: number;
  concurrencyLimit: number | null;
  costPerMinuteCents: number | null;
  status: string;
  isPublic: boolean;
  createdAt: string;
};

type UserItem = {
  id: string;
  name: string;
  email: string;
  role: string;
  balanceCents: number;
  createdAt: string;
  updatedAt?: string;
};

type CampaignItem = {
  id: string;
  name: string;
  status: string;
  callerId: string;
  callsPerMinute: number;
  maxConcurrentCalls: number;
  ringTimeoutSeconds: number;
  totalLeads: number;
  dialedCount: number;
  connectedCount: number;
  dtmfCount: number;
  costCents: number;
  route: { id: string; name: string; provider: string };
  callFlow: { id: string; name: string };
  createdAt: string;
};

type LiveCall = {
  id: string;
  status: string;
  callerId: string;
  dialedNumber: string;
  campaign: { id: string; name: string };
  lead: { phoneNumber: string; normalizedNumber: string | null };
  createdAt: string;
};

type SettingItem = {
  key: string;
  value: any;
  description: string | null;
};

function useToast() {
  const [items, setItems] = useState<{ id: string; message: string }[]>([]);
  const push = useCallback((message: string) => {
    const id = Math.random().toString(36).slice(2);
    setItems((list) => [...list, { id, message }]);
    setTimeout(() => {
      setItems((list) => list.filter((item) => item.id !== id));
    }, 2200);
  }, []);
  function View() {
    return (
      <div className="pointer-events-none fixed right-4 top-4 z-50 flex flex-col gap-2">
        <AnimatePresence>
          {items.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="pointer-events-auto rounded-xl bg-zinc-900/90 px-3 py-2 text-sm text-white shadow ring-1 ring-white/15"
            >
              {item.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    );
  }
  return { push, View };
}

async function jsonRequest(path: string, init?: RequestInit) {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error ?? "Request failed");
  }
  return data;
}

export default function AdminPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [calls, setCalls] = useState<LiveCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingRoute, setCreatingRoute] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const { push, View: Toasts } = useToast();
  usePageLoading(520);

  const [routeForm, setRouteForm] = useState({
    name: "",
    provider: "",
    domain: "",
    trunkPrefix: "",
    outboundUri: "",
    isPublic: true,
  });

  const [userForm, setUserForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "user",
  });

  const [settingDrafts, setSettingDrafts] = useState<{ key: string; value: string; description: string }[]>([]);

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const [statsRes, routesRes, usersRes, campaignsRes, callsRes, settingsRes] = await Promise.all([
        jsonRequest("/api/admin/dashboard"),
        jsonRequest("/api/admin/routes"),
        jsonRequest("/api/admin/users"),
        jsonRequest("/api/campaigns?scope=all"),
        jsonRequest("/api/admin/calls/live"),
        jsonRequest("/api/admin/settings"),
      ]);
      setStats(statsRes);
      setRoutes(routesRes.routes ?? []);
      setUsers(usersRes.users ?? []);
      setCampaigns(campaignsRes.campaigns ?? []);
      setCalls(callsRes.calls ?? []);
      setSettingDrafts(
        (settingsRes.settings ?? []).map((item: SettingItem) => ({
          key: item.key,
          value: typeof item.value === "string" ? item.value : JSON.stringify(item.value),
          description: item.description ?? "",
        }))
      );
    } catch (error: any) {
      push(error.message ?? "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [push]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const campaignGroups = useMemo(() => {
    const running = campaigns.filter((c) => c.status === "running");
    const others = campaigns.filter((c) => c.status !== "running");
    return { running, others };
  }, [campaigns]);

  async function handleCreateRoute() {
    if (creatingRoute) return;
    try {
      setCreatingRoute(true);
      const payload = {
        name: routeForm.name,
        provider: routeForm.provider,
        domain: routeForm.domain,
        trunkPrefix: routeForm.trunkPrefix || null,
        outboundUri: routeForm.outboundUri || null,
        isPublic: routeForm.isPublic,
      };
      const res = await jsonRequest("/api/admin/routes", { method: "POST", body: JSON.stringify(payload) });
      setRoutes((list) => [res.route, ...list]);
      setRouteForm({
        name: "",
        provider: "",
        domain: "",
        trunkPrefix: "",
        outboundUri: "",
        isPublic: true,
      });
      push("Route created");
    } catch (error: any) {
      push(error.message ?? "Unable to create route");
    } finally {
      setCreatingRoute(false);
    }
  }

  async function handleToggleRoute(route: RouteItem, field: "isPublic" | "status") {
    try {
      const value =
        field === "isPublic"
          ? { isPublic: !route.isPublic }
          : { status: route.status === "active" ? "inactive" : "active" };
      const res = await jsonRequest(`/api/admin/routes/${route.id}`, {
        method: "PATCH",
        body: JSON.stringify(value),
      });
      setRoutes((list) => list.map((item) => (item.id === route.id ? res.route : item)));
      push("Route updated");
    } catch (error: any) {
      push(error.message ?? "Unable to update route");
    }
  }

  async function handleCreateUser() {
    if (creatingUser) return;
    try {
      setCreatingUser(true);
      const payload = { ...userForm };
      const res = await jsonRequest("/api/admin/users", { method: "POST", body: JSON.stringify(payload) });
      setUsers((list) => [res.user, ...list]);
      setUserForm({ name: "", email: "", password: "", role: "user" });
      push("User created");
    } catch (error: any) {
      push(error.message ?? "Unable to create user");
    } finally {
      setCreatingUser(false);
    }
  }

  async function handleBalance(userId: string, amount: number, type: "credit" | "debit") {
    try {
      const payload = { amountCents: Math.round(Math.abs(amount) * 100), type };
      const res = await jsonRequest(`/api/admin/users/${userId}/balance`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setUsers((list) => list.map((item) => (item.id === userId ? res.user : item)));
      push(type === "credit" ? "Balance credited" : "Balance debited");
    } catch (error: any) {
      push(error.message ?? "Unable to adjust balance");
    }
  }

  async function handleCampaignAction(id: string, action: "start" | "pause" | "stop") {
    try {
      await jsonRequest(`/api/campaigns/${id}/${action}`, { method: "POST", body: JSON.stringify({}) });
      await loadAll();
      push(`Campaign ${action === "start" ? "started" : action === "pause" ? "paused" : "stopped"}`);
    } catch (error: any) {
      push(error.message ?? "Unable to update campaign");
    }
  }

  async function handleSaveSettings() {
    if (savingSettings) return;
    try {
      setSavingSettings(true);
      const formatted = settingDrafts
        .filter((item) => item.key.trim().length > 0)
        .map((item) => {
          let parsed: any = item.value;
          try {
            parsed = JSON.parse(item.value);
          } catch {
            parsed = item.value;
          }
          return {
            key: item.key.trim(),
            value: parsed,
            description: item.description || undefined,
          };
        });
      if (formatted.length === 0) {
        push("Nothing to save");
        return;
      }
      await jsonRequest("/api/admin/settings", {
        method: "POST",
        body: JSON.stringify({ settings: formatted }),
      });
      push("Settings saved");
      await loadAll();
    } catch (error: any) {
      push(error.message ?? "Unable to save settings");
    } finally {
      setSavingSettings(false);
    }
  }

  function StatSkeleton() {
    return (
      <MotionCard tone="neutral" className="p-5">
        <ShimmerTile className="h-5 w-32 rounded-full" />
        <ShimmerTile className="mt-4 h-8 rounded-xl" />
      </MotionCard>
    );
  }

  return (
    <PageFrame
      eyebrow="Command"
      title="Admin operations center"
      description="Coordinate routes, campaigns, balances and live traffic across the entire telephony network."
    >
      <Toasts />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading || !stats ? (
          <>
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
          </>
        ) : (
          <>
            <MotionCard tone="neutral" className="p-5 sm:p-6">
              <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Users</div>
              <div className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-white">
                {stats.users.toLocaleString()}
              </div>
            </MotionCard>
            <MotionCard tone="emerald" className="p-5 sm:p-6">
              <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Campaigns live</div>
              <div className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-white">
                {stats.campaigns.running.toLocaleString()}
              </div>
              <div className="mt-2 text-xs text-zinc-500">
                {stats.campaigns.total.toLocaleString()} total · {stats.campaigns.completed.toLocaleString()} completed
              </div>
            </MotionCard>
            <MotionCard tone="violet" className="p-5 sm:p-6">
              <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Captured DTMF</div>
              <div className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-white">
                {stats.activeCalls.toLocaleString()}
              </div>
              <div className="mt-2 text-xs text-zinc-500">Active call legs in progress</div>
            </MotionCard>
            <MotionCard tone="amber" className="p-5 sm:p-6">
              <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Volume processed</div>
              <div className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-white">
                ${(stats.volumeCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </MotionCard>
          </>
        )}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <MotionCard tone="neutral" className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">SIP routes</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                Publish or retire outbound carriers instantly.
              </div>
            </div>
            <button
              onClick={loadAll}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/60 bg-white/60 text-zinc-600 transition hover:bg-white dark:border-white/15 dark:bg-white/10 dark:text-white"
            >
              <Icons.Refresh className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
              <div className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-200">Create route</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  value={routeForm.name}
                  onChange={(e) => setRouteForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Name"
                  className="rounded-xl border border-white/50 bg-white/70 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40 dark:border-white/10 dark:bg-white/5 dark:text-white"
                />
                <input
                  value={routeForm.provider}
                  onChange={(e) => setRouteForm((f) => ({ ...f, provider: e.target.value }))}
                  placeholder="Provider"
                  className="rounded-xl border border-white/50 bg-white/70 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40 dark:border-white/10 dark:bg-white/5 dark:text-white"
                />
                <input
                  value={routeForm.domain}
                  onChange={(e) => setRouteForm((f) => ({ ...f, domain: e.target.value }))}
                  placeholder="SIP domain or gateway"
                  className="rounded-xl border border-white/50 bg-white/70 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40 dark:border-white/10 dark:bg-white/5 dark:text-white sm:col-span-2"
                />
                <input
                  value={routeForm.trunkPrefix}
                  onChange={(e) => setRouteForm((f) => ({ ...f, trunkPrefix: e.target.value }))}
                  placeholder="Trunk prefix"
                  className="rounded-xl border border-white/50 bg-white/70 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40 dark:border-white/10 dark:bg-white/5 dark:text-white"
                />
                <input
                  value={routeForm.outboundUri}
                  onChange={(e) => setRouteForm((f) => ({ ...f, outboundUri: e.target.value }))}
                  placeholder="Custom endpoint (use {number})"
                  className="rounded-xl border border-white/50 bg-white/70 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40 dark:border-white/10 dark:bg-white/5 dark:text-white"
                />
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-300">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={routeForm.isPublic}
                    onChange={(e) => setRouteForm((f) => ({ ...f, isPublic: e.target.checked }))}
                    className="h-4 w-4 accent-emerald-500"
                  />
                  Public for all users
                </label>
                <button
                  disabled={creatingRoute}
                  onClick={handleCreateRoute}
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Icons.Plus className="h-3.5 w-3.5" />
                  {creatingRoute ? "Creating..." : "Add route"}
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {routes.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/60 p-6 text-center text-sm text-zinc-500 dark:border-white/15 dark:text-zinc-400">
                  No routes yet. Publish a provider to begin.
                </div>
              ) : (
                routes.map((route) => (
                  <div
                    key={route.id}
                    className="flex flex-col gap-3 rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                        {route.name} · {route.provider}
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        {route.domain}
                        {route.trunkPrefix ? ` · prefix ${route.trunkPrefix}` : ""}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${
                          route.status === "active"
                            ? "bg-emerald-500/15 text-emerald-600 ring-emerald-400/40"
                            : route.status === "maintenance"
                            ? "bg-amber-500/15 text-amber-600 ring-amber-400/40"
                            : "bg-rose-500/15 text-rose-600 ring-rose-400/40"
                        }`}
                      >
                        {route.status}
                      </span>
                      <button
                        onClick={() => handleToggleRoute(route, "status")}
                        className="rounded-full border border-white/60 px-3 py-1 text-xs transition hover:bg-white dark:border-white/15 dark:hover:bg-white/10"
                      >
                        Toggle
                      </button>
                      <button
                        onClick={() => handleToggleRoute(route, "isPublic")}
                        className="rounded-full border border-white/60 px-3 py-1 text-xs transition hover:bg-white dark:border-white/15 dark:hover:bg-white/10"
                      >
                        {route.isPublic ? "Make private" : "Make public"}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </MotionCard>

        <MotionCard tone="neutral" className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">Users</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                Issue credentials and manage balances.
              </div>
            </div>
            <button
              onClick={loadAll}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/60 bg-white/60 text-zinc-600 transition hover:bg-white dark:border-white/15 dark:bg-white/10 dark:text-white"
            >
              <Icons.Refresh className="h-4 w-4" />
            </button>
          </div>

          <div className="rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
            <div className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-200">Create user</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                value={userForm.name}
                onChange={(e) => setUserForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Full name"
                className="rounded-xl border border-white/50 bg-white/70 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40 dark:border-white/10 dark:bg-white/5 dark:text-white"
              />
              <input
                value={userForm.email}
                onChange={(e) => setUserForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="Email"
                className="rounded-xl border border-white/50 bg-white/70 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40 dark:border-white/10 dark:bg-white/5 dark:text-white"
              />
              <input
                value={userForm.password}
                onChange={(e) => setUserForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="Password"
                type="password"
                className="rounded-xl border border-white/50 bg-white/70 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40 dark:border-white/10 dark:bg-white/5 dark:text-white"
              />
              <select
                value={userForm.role}
                onChange={(e) => setUserForm((f) => ({ ...f, role: e.target.value }))}
                className="rounded-xl border border-white/50 bg-white/70 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40 dark:border-white/10 dark:bg-white/5 dark:text-white"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
                <option value="superadmin">Superadmin</option>
              </select>
            </div>
            <button
              onClick={handleCreateUser}
              disabled={creatingUser}
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Icons.Plus className="h-3.5 w-3.5" />
              {creatingUser ? "Creating..." : "Add user"}
            </button>
          </div>

          <div className="mt-4 max-h-[320px] space-y-3 overflow-y-auto pr-1">
            {users.map((user) => (
              <div
                key={user.id}
                className="rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                      {user.name}
                    </div>
                    <div className="text-xs text-zinc-500">{user.email}</div>
                  </div>
                  <span className="rounded-full bg-indigo-500/15 px-2.5 py-1 text-[11px] font-semibold text-indigo-500">
                    {user.role}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    Balance: ${(user.balanceCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleBalance(user.id, 100, "credit")}
                      className="rounded-full border border-white/60 px-3 py-1 text-xs transition hover:bg-white dark:border-white/15 dark:hover:bg-white/10"
                    >
                      +$100
                    </button>
                    <button
                      onClick={() => handleBalance(user.id, 100, "debit")}
                      className="rounded-full border border-white/60 px-3 py-1 text-xs transition hover:bg-white dark:border-white/15 dark:hover:bg-white/10"
                    >
                      -$100
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </MotionCard>
      </div>

        <MotionCard tone="neutral" className="mt-6 p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">Campaign control</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                Launch, pause or retire campaigns with one click.
              </div>
            </div>
            <button
              onClick={loadAll}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/60 bg-white/60 text-zinc-600 transition hover:bg-white dark:border-white/15 dark:bg-white/10 dark:text-white"
            >
              <Icons.Refresh className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-6">
            <CampaignGroup
              title="Running"
              emptyLabel="No campaigns running."
              campaigns={campaignGroups.running}
              onAction={handleCampaignAction}
            />
            <CampaignGroup
              title="Other campaigns"
              emptyLabel="No additional campaigns."
              campaigns={campaignGroups.others}
              onAction={handleCampaignAction}
            />
          </div>
        </MotionCard>

      <MotionCard tone="neutral" className="mt-6 p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">Live calls</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              Monitor engaged legs and capture in-call context.
            </div>
          </div>
          <button
            onClick={loadAll}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/60 bg-white/60 text-zinc-600 transition hover:bg-white dark:border-white/15 dark:bg-white/10 dark:text-white"
          >
            <Icons.Refresh className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-hidden rounded-3xl border border-white/60 bg-white/70 shadow-inner backdrop-blur dark:border-white/10 dark:bg-white/5">
          <div className="max-h-[320px] overflow-y-auto">
            <table className="min-w-full divide-y divide-white/60 text-sm dark:divide-white/10">
              <thead className="bg-white/80 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:bg-white/5 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3 text-left">Time</th>
                  <th className="px-4 py-3 text-left">Campaign</th>
                  <th className="px-4 py-3 text-left">Caller</th>
                  <th className="px-4 py-3 text-left">Lead</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/50 bg-white/60 dark:divide-white/10 dark:bg-transparent">
                {calls.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
                      No active calls at the moment.
                    </td>
                  </tr>
                ) : (
                  calls.map((call) => (
                    <tr key={call.id} className="transition hover:bg-white dark:hover:bg-white/5">
                      <td className="px-4 py-3 text-xs text-zinc-500">
                        {new Date(call.createdAt).toLocaleTimeString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-700 dark:text-zinc-200">
                        {call.campaign.name}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500">{call.callerId}</td>
                      <td className="px-4 py-3 text-xs text-zinc-500">
                        {call.lead.normalizedNumber ?? call.lead.phoneNumber}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[11px] font-semibold text-sky-500">
                          {call.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </MotionCard>

      <MotionCard tone="neutral" className="mt-6 p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">System settings</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              Persist ARI credentials, callback URLs and automation toggles.
            </div>
          </div>
          <button
            onClick={() =>
              setSettingDrafts((drafts) => [
                ...drafts,
                { key: "", value: "", description: "" },
              ])
            }
            className="inline-flex h-9 items-center gap-2 rounded-full border border-white/60 bg-white/60 px-3 text-xs font-semibold text-zinc-600 transition hover:bg-white dark:border-white/15 dark:bg-white/10 dark:text-white"
          >
            <Icons.Plus className="h-3.5 w-3.5" />
            Add field
          </button>
        </div>

        <div className="space-y-3">
          {settingDrafts.map((draft, index) => (
            <div
              key={`${draft.key}-${index}`}
              className="rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5"
            >
              <div className="grid gap-2 sm:grid-cols-3">
                <input
                  value={draft.key}
                  onChange={(e) =>
                    setSettingDrafts((list) =>
                      list.map((item, i) => (i === index ? { ...item, key: e.target.value } : item))
                    )
                  }
                  placeholder="Key"
                  className="rounded-xl border border-white/50 bg-white/70 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/40 dark:border-white/10 dark:bg-white/5 dark:text-white"
                />
                <input
                  value={draft.value}
                  onChange={(e) =>
                    setSettingDrafts((list) =>
                      list.map((item, i) => (i === index ? { ...item, value: e.target.value } : item))
                    )
                  }
                  placeholder="Value (JSON or text)"
                  className="rounded-xl border border-white/50 bg-white/70 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/40 dark:border-white/10 dark:bg-white/5 dark:text-white sm:col-span-2"
                />
                <input
                  value={draft.description}
                  onChange={(e) =>
                    setSettingDrafts((list) =>
                      list.map((item, i) => (i === index ? { ...item, description: e.target.value } : item))
                    )
                  }
                  placeholder="Description"
                  className="sm:col-span-3 rounded-xl border border-white/50 bg-white/70 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/40 dark:border-white/10 dark:bg-white/5 dark:text-white"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={handleSaveSettings}
            disabled={savingSettings}
            className="inline-flex items-center gap-2 rounded-full bg-teal-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Icons.Save className="h-4 w-4" />
            {savingSettings ? "Saving..." : "Save settings"}
          </button>
        </div>
      </MotionCard>
    </PageFrame>
  );
}

type CampaignGroupProps = {
  title: string;
  emptyLabel: string;
  campaigns: CampaignItem[];
  onAction: (id: string, action: "start" | "pause" | "stop") => Promise<void>;
};

function CampaignGroup({ title, emptyLabel, campaigns, onAction }: CampaignGroupProps) {
  return (
    <div>
      <div className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-200">{title}</div>
      {campaigns.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/60 p-4 text-xs text-zinc-500 dark:border-white/10 dark:text-zinc-400">
          {emptyLabel}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {campaigns.map((campaign) => (
            <div
              key={campaign.id}
              className="rounded-2xl border border-white/60 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                    {campaign.name}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    Route {campaign.route.name} · Flow {campaign.callFlow.name}
                  </div>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${
                    campaign.status === "running"
                      ? "bg-emerald-500/15 text-emerald-500 ring-emerald-400/40"
                      : campaign.status === "paused"
                      ? "bg-amber-500/15 text-amber-500 ring-amber-400/40"
                      : campaign.status === "completed"
                      ? "bg-sky-500/15 text-sky-500 ring-sky-400/40"
                      : "bg-zinc-500/15 text-zinc-500 ring-zinc-400/40"
                  }`}
                >
                  {campaign.status}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
                <div>Caller ID {campaign.callerId}</div>
                <div>{campaign.callsPerMinute} cpm</div>
                <div>{campaign.maxConcurrentCalls} channels</div>
                <div>{campaign.dialedCount.toLocaleString()} dialed</div>
                <div>{campaign.connectedCount.toLocaleString()} answered</div>
                <div>{campaign.dtmfCount.toLocaleString()} dtmf</div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => onAction(campaign.id, "start")}
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-500 ring-1 ring-emerald-400/40 transition hover:bg-emerald-500/25"
                >
                  <Icons.Play className="h-3.5 w-3.5" />
                  Start
                </button>
                <button
                  onClick={() => onAction(campaign.id, "pause")}
                  className="inline-flex items-center gap-2 rounded-full bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-500 ring-1 ring-amber-400/40 transition hover:bg-amber-500/25"
                >
                  <Icons.Pause className="h-3.5 w-3.5" />
                  Pause
                </button>
                <button
                  onClick={() => onAction(campaign.id, "stop")}
                  className="inline-flex items-center gap-2 rounded-full bg-rose-500/15 px-3 py-1.5 text-xs font-semibold text-rose-500 ring-1 ring-rose-400/40 transition hover:bg-rose-500/25"
                >
                  <Icons.Stop className="h-3.5 w-3.5" />
                  Stop
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
