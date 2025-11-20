"use client";

import { useEffect, useMemo, useState } from "react";
import { PageFrame, MotionCard, ShimmerTile } from "@/components/ui/LuxuryPrimitives";

type WebhookPayload = {
  id: string;
  name: string;
  provider: "discord" | "telegram";
  active: boolean;
  config: Record<string, string>;
  lastFiredAt: string | null;
};

const providerOptions = [
  { key: "discord", label: "Discord" },
  { key: "telegram", label: "Telegram" },
];

const emptyForm = {
  id: null as string | null,
  name: "",
  provider: "discord" as "discord" | "telegram",
  webhookUrl: "",
  botToken: "",
  chatId: "",
  active: true,
};

export default function SettingsPage() {
  const [webhooks, setWebhooks] = useState<WebhookPayload[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/settings/webhooks", { cache: "no-store" });
        if (!res.ok) throw new Error("Unable to load webhooks");
        const data = await res.json();
        if (active) {
          setWebhooks(data.webhooks ?? []);
          setLoading(false);
        }
      } catch (err: any) {
        if (active) {
          setError(err?.message ?? "Unable to load webhooks");
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  function handleChange(field: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function resetForm() {
    setForm(emptyForm);
    setMessage(null);
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const payload: Record<string, any> = {
        id: form.id ?? undefined,
        name: form.name.trim(),
        provider: form.provider,
        active: form.active,
      };
      if (form.provider === "discord") {
        payload.webhookUrl = form.webhookUrl.trim();
      } else {
        payload.botToken = form.botToken.trim();
        payload.chatId = form.chatId.trim();
      }
      const res = await fetch("/api/settings/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Unable to save webhook");
      }
      const result = await res.json();
      setWebhooks((prev) => {
        const others = prev.filter((item) => item.id !== result.webhook.id);
        return [result.webhook, ...others];
      });
      setMessage(form.id ? "Webhook updated" : "Webhook added");
      setForm(emptyForm);
    } catch (err: any) {
      setError(err?.message ?? "Unable to save webhook");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(hook: WebhookPayload) {
    const next = !hook.active;
    setWebhooks((prev) => prev.map((item) => (item.id === hook.id ? { ...item, active: next } : item)));
    await fetch(`/api/settings/webhooks/${hook.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: next }),
    }).catch(() => {});
  }

  async function removeWebhook(id: string) {
    const current = webhooks.find((hook) => hook.id === id);
    setWebhooks((prev) => prev.filter((hook) => hook.id !== id));
    await fetch(`/api/settings/webhooks/${id}`, { method: "DELETE" }).catch(() => {
      if (current) {
        setWebhooks((prev) => [current, ...prev]);
      }
    });
  }

  function editWebhook(hook: WebhookPayload) {
    if (hook.provider === "discord") {
      setForm({
        id: hook.id,
        name: hook.name,
        provider: "discord",
        webhookUrl: hook.config.webhookUrl ?? "",
        botToken: "",
        chatId: "",
        active: hook.active,
      });
    } else {
      setForm({
        id: hook.id,
        name: hook.name,
        provider: "telegram",
        webhookUrl: "",
        botToken: hook.config.botToken ?? "",
        chatId: hook.config.chatId ?? "",
        active: hook.active,
      });
    }
    setMessage(null);
    setError(null);
  }

  const activeCount = useMemo(() => webhooks.filter((hook) => hook.active).length, [webhooks]);

  return (
    <PageFrame
      eyebrow="Settings"
      title="Realtime alerts"
      description="Push DTMF replies to Discord or Telegram instantly alongside the dashboard log."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <MotionCard tone="neutral" className="p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">Webhook form</div>
              <div className="text-sm text-zinc-500 dark:text-zinc-400">Build a new endpoint or edit an existing one.</div>
            </div>
            {form.id ? (
              <button onClick={resetForm} className="text-xs font-semibold text-emerald-500 hover:text-emerald-400">
                New
              </button>
            ) : null}
          </div>
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Label</label>
              <input
                value={form.name}
                onChange={(event) => handleChange("name", event.target.value)}
                className="mt-1 w-full rounded-2xl border border-white/60 bg-white/80 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 dark:border-white/10 dark:bg-white/5 dark:text-white"
                placeholder="Operations room"
                required
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Provider</label>
                <select
                  value={form.provider}
                  onChange={(event) => handleChange("provider", event.target.value as "discord" | "telegram")}
                  className="mt-1 w-full rounded-2xl border border-white/60 bg-white/80 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 dark:border-white/10 dark:bg-white/5 dark:text-white"
                >
                  {providerOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 pt-5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(event) => handleChange("active", event.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 text-emerald-500 focus:ring-emerald-400"
                />
                Active
              </div>
            </div>
            {form.provider === "discord" ? (
              <div>
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Discord webhook URL</label>
                <input
                  type="url"
                  value={form.webhookUrl}
                  onChange={(event) => handleChange("webhookUrl", event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-white/60 bg-white/80 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 dark:border-white/10 dark:bg-white/5 dark:text-white"
                  placeholder="https://discord.com/api/webhooks/..."
                  required
                />
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Bot token</label>
                  <input
                    value={form.botToken}
                    onChange={(event) => handleChange("botToken", event.target.value)}
                    className="mt-1 w-full rounded-2xl border border-white/60 bg-white/80 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 dark:border-white/10 dark:bg-white/5 dark:text-white"
                    placeholder="123456:ABC..."
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Group chat ID</label>
                  <input
                    value={form.chatId}
                    onChange={(event) => handleChange("chatId", event.target.value)}
                    className="mt-1 w-full rounded-2xl border border-white/60 bg-white/80 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 dark:border-white/10 dark:bg-white/5 dark:text-white"
                    placeholder="-10012345678"
                    required
                  />
                </div>
              </div>
            )}
            {error ? <div className="text-sm text-rose-500">{error}</div> : null}
            {message ? <div className="text-sm text-emerald-500">{message}</div> : null}
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-emerald-400 disabled:opacity-60"
            >
              {saving ? "Saving..." : form.id ? "Update webhook" : "Create webhook"}
            </button>
          </form>
        </MotionCard>
        <MotionCard tone="neutral" className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">Active outputs</div>
              <div className="text-sm text-zinc-500 dark:text-zinc-400">{activeCount} enabled</div>
            </div>
          </div>
          {loading ? (
            <div className="mt-5 space-y-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <ShimmerTile key={index} className="h-14 rounded-2xl" />
              ))}
            </div>
          ) : webhooks.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-white/60 bg-white/60 p-6 text-sm text-zinc-500 dark:border-white/10 dark:bg-white/5 dark:text-zinc-400">
              No webhooks yet. Add one to stream DTMF events to Discord or Telegram.
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {webhooks.map((hook) => (
                <div
                  key={hook.id}
                  className={`rounded-2xl border px-4 py-3 transition ${hook.active ? "border-emerald-400/40 bg-emerald-500/10" : "border-white/30 bg-white/60 dark:border-white/10 dark:bg-white/5"}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-zinc-900 dark:text-white">{hook.name}</div>
                      <div className="text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">{hook.provider}</div>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        onClick={() => editWebhook(hook)}
                        className="rounded-full border border-white/60 px-3 py-1 font-semibold text-zinc-700 hover:text-emerald-500 dark:border-white/20 dark:text-zinc-200"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => toggleActive(hook)}
                        className="rounded-full border border-white/60 px-3 py-1 font-semibold text-zinc-700 hover:text-emerald-500 dark:border-white/20 dark:text-zinc-200"
                      >
                        {hook.active ? "Disable" : "Enable"}
                      </button>
                      <button
                        onClick={() => removeWebhook(hook.id)}
                        className="rounded-full border border-rose-400/40 px-3 py-1 font-semibold text-rose-500 hover:bg-rose-500/10"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                    Last delivery{" "}
                    {hook.lastFiredAt ? new Date(hook.lastFiredAt).toLocaleString() : "never"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </MotionCard>
      </div>
    </PageFrame>
  );
}
