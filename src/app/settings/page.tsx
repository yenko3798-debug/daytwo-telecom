"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageFrame, MotionCard, ShimmerTile } from "@/components/ui/LuxuryPrimitives";
import { usePageLoading } from "@/hooks/usePageLoading";

type Endpoint = {
  id: string;
  type: string;
  label: string | null;
  enabled: boolean;
  createdAt: string;
  discordPreview?: string | null;
  telegramChatId?: string | null;
  telegramTokenHint?: string | null;
};

type Toast = { id: string; message: string; tone: "success" | "error" };

function useToast() {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((message: string, tone: Toast["tone"] = "success") => {
    const id = crypto.randomUUID();
    setItems((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }, 2500);
  }, []);
  const View = useCallback(
    () => (
      <div className="pointer-events-none fixed right-4 top-4 z-50 flex flex-col gap-2">
        {items.map((item) => (
          <div
            key={item.id}
            className={`pointer-events-auto rounded-2xl px-4 py-2 text-sm text-white shadow ring-1 ring-white/10 ${
              item.tone === "error" ? "bg-rose-500/80" : "bg-emerald-500/80"
            }`}
          >
            {item.message}
          </div>
        ))}
      </div>
    ),
    [items]
  );
  return { push, View };
}

async function jsonRequest<T>(path: string, init?: RequestInit) {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  const data = (await res.json().catch(() => null)) as T | { error?: string } | null;
  if (!res.ok) {
    throw new Error((data as any)?.error ?? "Request failed");
  }
  return data as T;
}

export default function SettingsPage() {
  const { loading: introLoading } = usePageLoading(320);
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [discordForm, setDiscordForm] = useState({ label: "", webhookUrl: "" });
  const [telegramForm, setTelegramForm] = useState({ label: "", botToken: "", chatId: "" });
  const [submitting, setSubmitting] = useState(false);
  const { push, View: Toasts } = useToast();

  const loadEndpoints = useCallback(async () => {
    try {
      setLoading(true);
      const data = (await jsonRequest<{ endpoints: Endpoint[] }>("/api/settings/webhooks")) ?? {
        endpoints: [],
      };
      setEndpoints(data.endpoints ?? []);
    } catch (error: any) {
      push(error?.message ?? "Unable to load webhooks", "error");
    } finally {
      setLoading(false);
    }
  }, [push]);

  useEffect(() => {
    loadEndpoints();
  }, [loadEndpoints]);

  const hasDiscord = useMemo(() => endpoints.some((endpoint) => endpoint.type === "discord"), [endpoints]);
  const hasTelegram = useMemo(() => endpoints.some((endpoint) => endpoint.type === "telegram"), [endpoints]);

  async function handleCreate(type: "discord" | "telegram") {
    if (submitting) return;
    try {
      setSubmitting(true);
      if (type === "discord") {
        await jsonRequest("/api/settings/webhooks", {
          method: "POST",
          body: JSON.stringify({
            type: "discord",
            label: discordForm.label.trim() || undefined,
            webhookUrl: discordForm.webhookUrl.trim(),
          }),
        });
        setDiscordForm({ label: "", webhookUrl: "" });
      } else {
        await jsonRequest("/api/settings/webhooks", {
          method: "POST",
          body: JSON.stringify({
            type: "telegram",
            label: telegramForm.label.trim() || undefined,
            botToken: telegramForm.botToken.trim(),
            chatId: telegramForm.chatId.trim(),
          }),
        });
        setTelegramForm({ label: "", botToken: "", chatId: "" });
      }
      await loadEndpoints();
      push("Webhook saved");
    } catch (error: any) {
      push(error?.message ?? "Unable to save webhook", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggle(endpoint: Endpoint) {
    try {
      await jsonRequest(`/api/settings/webhooks/${endpoint.id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: !endpoint.enabled }),
      });
      setEndpoints((list) =>
        list.map((item) => (item.id === endpoint.id ? { ...item, enabled: !item.enabled } : item))
      );
    } catch (error: any) {
      push(error?.message ?? "Unable to update webhook", "error");
    }
  }

  async function handleDelete(endpoint: Endpoint) {
    try {
      await jsonRequest(`/api/settings/webhooks/${endpoint.id}`, { method: "DELETE", body: JSON.stringify({}) });
      setEndpoints((list) => list.filter((item) => item.id !== endpoint.id));
    } catch (error: any) {
      push(error?.message ?? "Unable to delete webhook", "error");
    }
  }

  const busy = loading || introLoading;

  return (
    <PageFrame
      eyebrow="Settings"
      title="Webhook delivery"
      description="Send every DTMF reply to Discord or Telegram in real time."
    >
      <Toasts />
      <div className="grid gap-4 lg:grid-cols-2">
        <MotionCard tone="neutral" className="space-y-4 p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Discord</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                {hasDiscord ? "Add another webhook" : "Send replies to a channel"}
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
              Label
              <input
                value={discordForm.label}
                onChange={(e) => setDiscordForm((prev) => ({ ...prev, label: e.target.value }))}
                className="mt-1 w-full rounded-2xl border border-white/60 bg-white/80 px-3 py-2 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-emerald-400/60 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100"
                placeholder="Channel name"
              />
            </label>
            <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
              Webhook URL
              <input
                value={discordForm.webhookUrl}
                onChange={(e) => setDiscordForm((prev) => ({ ...prev, webhookUrl: e.target.value }))}
                className="mt-1 w-full rounded-2xl border border-white/60 bg-white/80 px-3 py-2 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-emerald-400/60 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100"
                placeholder="https://discord.com/api/webhooks/..."
              />
            </label>
            <button
              onClick={() => handleCreate("discord")}
              disabled={!discordForm.webhookUrl.trim() || submitting}
              className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(16,185,129,0.35)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_40px_rgba(16,185,129,0.45)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Saving..." : hasDiscord ? "Add webhook" : "Connect Discord"}
            </button>
          </div>
        </MotionCard>

        <MotionCard tone="neutral" className="space-y-4 p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Telegram</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                {hasTelegram ? "Send to additional chats" : "Log to a group ID"}
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
              Label
              <input
                value={telegramForm.label}
                onChange={(e) => setTelegramForm((prev) => ({ ...prev, label: e.target.value }))}
                className="mt-1 w-full rounded-2xl border border-white/60 bg-white/80 px-3 py-2 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-sky-400/60 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100"
                placeholder="Notifications"
              />
            </label>
            <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
              Bot token
              <input
                value={telegramForm.botToken}
                onChange={(e) => setTelegramForm((prev) => ({ ...prev, botToken: e.target.value }))}
                className="mt-1 w-full rounded-2xl border border-white/60 bg-white/80 px-3 py-2 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-sky-400/60 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100"
                placeholder="123456:ABC..."
              />
            </label>
            <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
              Chat ID
              <input
                value={telegramForm.chatId}
                onChange={(e) => setTelegramForm((prev) => ({ ...prev, chatId: e.target.value }))}
                className="mt-1 w-full rounded-2xl border border-white/60 bg-white/80 px-3 py-2 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-sky-400/60 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100"
                placeholder="-1001234567890"
              />
            </label>
            <button
              onClick={() => handleCreate("telegram")}
              disabled={
                !telegramForm.botToken.trim() || !telegramForm.chatId.trim() || submitting
              }
              className="w-full rounded-2xl bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(14,165,233,0.35)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_40px_rgba(14,165,233,0.45)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Saving..." : hasTelegram ? "Add webhook" : "Connect Telegram"}
            </button>
          </div>
        </MotionCard>
      </div>

      <MotionCard tone="neutral" className="mt-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Active endpoints</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              {endpoints.length === 0 ? "No webhooks yet" : "Toggle delivery per destination"}
            </div>
          </div>
          <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-zinc-600 ring-1 ring-white/60 dark:bg-white/10 dark:text-zinc-300 dark:ring-white/10">
            {endpoints.length} connected
          </span>
        </div>
        {busy ? (
          <div className="mt-4 space-y-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <ShimmerTile key={index} className="h-16 rounded-2xl" />
            ))}
          </div>
        ) : endpoints.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-zinc-300/60 px-4 py-6 text-center text-sm text-zinc-500 dark:border-white/15 dark:text-zinc-400">
            Connect Discord or Telegram above to start receiving live replies.
          </div>
        ) : (
          <div className="mt-4 divide-y divide-white/80 rounded-3xl border border-white/70 bg-white/80 dark:divide-white/10 dark:border-white/10 dark:bg-white/5">
            {endpoints.map((endpoint) => (
              <div
                key={endpoint.id}
                className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm text-zinc-700 dark:text-zinc-200"
              >
                <div className="flex flex-1 flex-col">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-zinc-900/5 px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:bg-white/10 dark:text-zinc-300">
                      {endpoint.type}
                    </span>
                    <span className="font-semibold text-zinc-900 dark:text-white">
                      {endpoint.label || "Untitled"}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {endpoint.type === "discord"
                      ? endpoint.discordPreview ?? "discord webhook"
                      : `chat ${endpoint.telegramChatId ?? "—"} · token ${endpoint.telegramTokenHint ?? "—"}`}
                  </div>
                </div>
                <button
                  onClick={() => handleToggle(endpoint)}
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 transition ${
                    endpoint.enabled
                      ? "bg-emerald-500/15 text-emerald-600 ring-emerald-400/40 dark:bg-emerald-500/10 dark:text-emerald-300"
                      : "bg-white text-zinc-500 ring-zinc-200 dark:bg-white/5 dark:text-zinc-300"
                  }`}
                >
                  {endpoint.enabled ? "Enabled" : "Muted"}
                </button>
                <button
                  onClick={() => handleDelete(endpoint)}
                  className="rounded-full px-3 py-1 text-xs font-semibold text-rose-500 transition hover:bg-rose-500/10"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </MotionCard>
    </PageFrame>
  );
}
