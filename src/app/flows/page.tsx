"use client";

import React, { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Switch, Transition } from "@headlessui/react";
import clsx from "clsx";
import {
  FlowDefinition,
  FlowDefinitionSchema,
  FlowNode,
  Playback,
  summarizeFlow,
} from "@/lib/flows";
import { PageFrame, MotionCard, ShimmerTile } from "@/components/ui/LuxuryPrimitives";
import { usePageLoading } from "@/hooks/usePageLoading";

type FlowRecord = {
  id: string;
  name: string;
  description: string | null;
  definition: FlowDefinition;
  isSystem: boolean;
  updatedAt: string;
  metadata?: any;
};

type FlowDraft = {
  id: string | null;
  isNew: boolean;
  isSystem: boolean;
  name: string;
  description: string;
  definition: FlowDefinition;
  dirty: boolean;
  saving: boolean;
};

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

const Icons = {
  Plus: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  Trash: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
    </svg>
  ),
  Save: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
      <path d="M17 21v-8H7v8" />
      <path d="M7 3v5h8" />
    </svg>
  ),
  Download: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <path d="M7 10l5 5 5-5" />
      <path d="M12 15V3" />
    </svg>
  ),
  Audio: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M9 5v14l12-7-12-7z" />
      <path d="M5 6v12" />
    </svg>
  ),
  Duplicate: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M8 8h12v12H8z" />
      <path d="M4 4h12v12" />
    </svg>
  ),
  ArrowUp: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M12 5l-7 7h4v7h6v-7h4z" />
    </svg>
  ),
  ArrowDown: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M12 19l7-7h-4V5h-6v7H5z" />
    </svg>
  ),
};

function createPlayback(mode: Playback["mode"] = "tts"): Playback {
  if (mode === "file") {
    return { mode: "file", url: "", mimeType: undefined };
  }
  return { mode: "tts", text: "Hello, thank you for calling." };
}

function createFlowTemplate(): FlowDefinition {
  const intro = `intro-${Math.random().toString(36).slice(2, 7)}`;
  const gather = `gather-${Math.random().toString(36).slice(2, 7)}`;
  const end = `end-${Math.random().toString(36).slice(2, 7)}`;
  return {
    name: "Untitled flow",
    entry: intro,
    nodes: [
      {
        id: intro,
        name: "Greeting",
        type: "play",
        playback: createPlayback("tts"),
        next: gather,
      },
      {
        id: gather,
        name: "Menu",
        type: "gather",
        prompt: createPlayback("tts"),
        maxDigits: 1,
        minDigits: 1,
        timeoutSeconds: 5,
        attempts: 1,
        variable: "dtmf",
        branches: {},
        defaultNext: end,
      },
      {
        id: end,
        name: "Hangup",
        type: "hangup",
      },
    ],
  };
}

function cloneDefinition(definition: FlowDefinition): FlowDefinition {
  return JSON.parse(JSON.stringify(definition));
}

function findNode(definition: FlowDefinition, id: string) {
  return definition.nodes.find((node) => node.id === id);
}

function sanitizeDefinition(definition: FlowDefinition, removedId: string): FlowDefinition {
  const nodes = definition.nodes.map((node) => {
    if (node.id === removedId) return node;
    const nextNode =
      "next" in node && node.next === removedId
        ? { ...node, next: undefined }
        : node;
    if (nextNode.type !== "gather") return nextNode;
    const branches = { ...nextNode.branches };
    Object.entries(branches).forEach(([digit, target]) => {
      if (target === removedId) delete branches[digit];
    });
    const defaultNext = nextNode.defaultNext === removedId ? undefined : nextNode.defaultNext;
    return { ...nextNode, branches, defaultNext };
  });
  const filtered = nodes.filter((node) => node.id !== removedId);
  const entry = definition.entry === removedId ? filtered[0]?.id ?? "" : definition.entry;
  return { ...definition, entry, nodes: filtered };
}

function getNodeLabel(node: FlowNode) {
  if (node.name) return node.name;
  if (node.type === "play") return "Play audio";
  if (node.type === "gather") return "Gather digits";
  if (node.type === "dial") return "Dial";
  if (node.type === "pause") return "Pause";
  return "Hang up";
}

function formatTimeAgo(timestamp: string) {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes === 1) return "1 minute ago";
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours === 1) return "1 hour ago";
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;
  return new Date(timestamp).toLocaleDateString();
}

type NodeType = FlowNode["type"];

const NODE_TYPES: Array<{ type: NodeType; label: string; description: string }> = [
  { type: "play", label: "Play", description: "Speak text or play an audio file" },
  { type: "gather", label: "Gather", description: "Collect DTMF input from the caller" },
  { type: "dial", label: "Dial", description: "Forward the call to another endpoint" },
  { type: "pause", label: "Pause", description: "Wait for a few seconds" },
  { type: "hangup", label: "Hangup", description: "Terminate the call" },
];

function createNode(type: NodeType): FlowNode {
  const id = `${type}-${Math.random().toString(36).slice(2, 8)}`;
  if (type === "play") {
    return {
      id,
      name: "Play",
      type,
      playback: createPlayback("tts"),
    };
  }
  if (type === "gather") {
    return {
      id,
      name: "Gather",
      type,
      prompt: createPlayback("tts"),
      maxDigits: 1,
      minDigits: 1,
      timeoutSeconds: 5,
      attempts: 1,
      variable: "dtmf",
      branches: {},
      defaultNext: undefined,
    };
  }
  if (type === "dial") {
    return {
      id,
      name: "Dial",
      type,
      endpoint: "SIP/provider/{number}",
      timeoutSeconds: 45,
      next: undefined,
    };
  }
  if (type === "pause") {
    return {
      id,
      name: "Pause",
      type,
      durationSeconds: 3,
      next: undefined,
    };
  }
  return {
    id,
    name: "Hangup",
    type: "hangup",
  };
}

export default function FlowBuilderPage() {
  const [flows, setFlows] = useState<FlowRecord[]>([]);
  const [draft, setDraft] = useState<FlowDraft | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { push, View: Toasts } = useToast();
  usePageLoading(640);

  const loadFlows = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/flows", { cache: "no-store" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Unable to load flows");
      }
      const data = await res.json();
      const mapped: FlowRecord[] = (data.flows ?? []).map((flow: any) => ({
        id: flow.id,
        name: flow.name,
        description: flow.description ?? "",
        definition: FlowDefinitionSchema.parse(flow.definition),
        isSystem: flow.isSystem,
        updatedAt: flow.updatedAt,
        metadata: flow.metadata ?? null,
      }));
      setFlows(mapped);
      setDraft((current) => {
        if (mapped.length === 0) {
          return current?.isNew ? current : null;
        }
        if (!current) {
          const first = mapped[0];
          return {
            id: first.id,
            isNew: false,
            isSystem: first.isSystem,
            name: first.name,
            description: first.description ?? "",
            definition: cloneDefinition(first.definition),
            dirty: false,
            saving: false,
          };
        }
        if (current.isNew) {
          return current;
        }
        const active = current.id ? mapped.find((flow) => flow.id === current.id) : null;
        if (!active) {
          const first = mapped[0];
          return {
            id: first.id,
            isNew: false,
            isSystem: first.isSystem,
            name: first.name,
            description: first.description ?? "",
            definition: cloneDefinition(first.definition),
            dirty: false,
            saving: false,
          };
        }
        if (current.dirty) {
          return { ...current, isSystem: active.isSystem };
        }
        return {
          ...current,
          id: active.id,
          isSystem: active.isSystem,
          name: active.name,
          description: active.description ?? "",
          definition: cloneDefinition(active.definition),
          dirty: false,
          saving: false,
        };
      });
    } catch (error: any) {
      push(error?.message ?? "Unable to load flows", "error");
    } finally {
      setLoading(false);
    }
  }, [push]);

  useEffect(() => {
    loadFlows();
  }, [loadFlows]);

  const selectFlow = useCallback(
    (id: string) => {
      const record = flows.find((flow) => flow.id === id);
      if (!record) return;
      setDraft({
        id: record.id,
        isNew: false,
        isSystem: record.isSystem,
        name: record.name,
        description: record.description ?? "",
        definition: cloneDefinition(record.definition),
        dirty: false,
        saving: false,
      });
    },
    [flows]
  );

  const startNewFlow = useCallback(() => {
    const template = createFlowTemplate();
    setDraft({
      id: null,
      isNew: true,
      isSystem: false,
      name: template.name,
      description: "",
      definition: template,
      dirty: true,
      saving: false,
    });
  }, []);

  const updateDraft = useCallback((updater: (current: FlowDraft) => FlowDraft) => {
    setDraft((current) => {
      if (!current) return current;
      return updater(current);
    });
  }, []);

  const handleNameChange = useCallback((value: string) => {
    updateDraft((current) => ({
      ...current,
      name: value,
      dirty: true,
    }));
  }, [updateDraft]);

  const handleDescriptionChange = useCallback((value: string) => {
    updateDraft((current) => ({
      ...current,
      description: value,
      dirty: true,
    }));
  }, [updateDraft]);

  const updateDefinition = useCallback(
    (transform: (definition: FlowDefinition) => FlowDefinition) => {
      updateDraft((current) => ({
        ...current,
        definition: transform(current.definition),
        dirty: true,
      }));
    },
    [updateDraft]
  );

  const updateNode = useCallback(
    (id: string, mapper: (node: FlowNode) => FlowNode) => {
      updateDefinition((definition) => ({
        ...definition,
        nodes: definition.nodes.map((node) => (node.id === id ? mapper(node) : node)),
      }));
    },
    [updateDefinition]
  );

  const duplicateNode = useCallback(
    (id: string) => {
      updateDefinition((definition) => {
        const node = findNode(definition, id);
        if (!node) return definition;
        const copy = JSON.parse(JSON.stringify(node));
        copy.id = `${node.type}-${Math.random().toString(36).slice(2, 8)}`;
        copy.name = `${getNodeLabel(node)} copy`;
        return {
          ...definition,
          nodes: [...definition.nodes, copy],
        };
      });
    },
    [updateDefinition]
  );

  const removeNode = useCallback(
    (id: string) => {
      if (!draft) return;
      if (draft.definition.nodes.length <= 1) {
        push("A flow needs at least one step", "error");
        return;
      }
      updateDefinition((definition) => sanitizeDefinition(definition, id));
    },
    [draft, push, updateDefinition]
  );

  const moveNode = useCallback(
    (id: string, direction: -1 | 1) => {
      updateDefinition((definition) => {
        const index = definition.nodes.findIndex((node) => node.id === id);
        if (index < 0) return definition;
        const target = index + direction;
        if (target < 0 || target >= definition.nodes.length) return definition;
        const nodes = [...definition.nodes];
        const [node] = nodes.splice(index, 1);
        nodes.splice(target, 0, node);
        return { ...definition, nodes };
      });
    },
    [updateDefinition]
  );

  const addNode = useCallback(
    (type: NodeType) => {
      updateDefinition((definition) => {
        const newNode = createNode(type);
        const nodes = [...definition.nodes];
        const last = nodes[nodes.length - 1];
        if (last && "next" in last && last.type !== "hangup") {
          last.next = newNode.id;
        }
        return {
          ...definition,
          nodes: [...nodes, newNode],
        };
      });
    },
    [updateDefinition]
  );

  const setEntry = useCallback(
    (id: string) => {
      updateDefinition((definition) => ({
        ...definition,
        entry: id,
      }));
    },
    [updateDefinition]
  );

  const uploadAudio = useCallback(
    async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/media/audio", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Unable to upload audio");
      }
      return res.json();
    },
    []
  );

  const handleSave = useCallback(async () => {
    if (!draft) return;
    if (!draft.dirty && !draft.isNew) {
      push("Nothing to save", "info");
      return;
    }
    try {
      const payload = {
        name: draft.name.trim() || "Untitled flow",
        description: draft.description.trim() ? draft.description.trim() : undefined,
        definition: FlowDefinitionSchema.parse(draft.definition),
      };
      setDraft((current) => (current ? { ...current, saving: true } : current));
      if (draft.id) {
        const res = await fetch(`/api/flows/${draft.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error ?? "Unable to update flow");
        }
      } else {
        const res = await fetch("/api/flows", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error ?? "Unable to create flow");
        }
      }
      await loadFlows();
      push("Flow saved", "success");
      setDraft((current) =>
        current
          ? {
              ...current,
              dirty: false,
              isNew: false,
              saving: false,
            }
          : current
      );
    } catch (error: any) {
      push(error?.message ?? "Unable to save flow", "error");
      setDraft((current) => (current ? { ...current, saving: false } : current));
    }
  }, [draft, loadFlows, push]);

  const handleDelete = useCallback(async () => {
    if (!draft || !draft.id) return;
    if (draft.isSystem) {
      push("System flows cannot be removed", "error");
      return;
    }
    try {
      const res = await fetch(`/api/flows/${draft.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Unable to delete flow");
      }
      push("Flow removed", "success");
      await loadFlows();
      setDraft(null);
    } catch (error: any) {
      push(error?.message ?? "Unable to delete flow", "error");
    }
  }, [draft, loadFlows, push]);

  const handleExport = useCallback(() => {
    if (!draft) return;
    const blob = new Blob([JSON.stringify(draft.definition, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${draft.name.replace(/\s+/g, "_") || "flow"}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [draft]);

  useEffect(() => {
    if (!draft) {
      setSelectedNodeId(null);
      return;
    }
    setSelectedNodeId((current) => {
      if (current && draft.definition.nodes.some((node) => node.id === current)) {
        return current;
      }
      return draft.definition.entry ?? draft.definition.nodes[0]?.id ?? null;
    });
  }, [draft]);

  const summary = useMemo(() => {
    if (!draft) return null;
    return summarizeFlow(draft.definition);
  }, [draft]);

  const totals = useMemo(() => {
    if (!draft) return null;
    return draft.definition.nodes.reduce<Record<string, number>>((acc, node) => {
      acc[node.type] = (acc[node.type] ?? 0) + 1;
      return acc;
    }, {});
  }, [draft]);

  const selectedNode = useMemo(() => {
    if (!draft) return null;
    if (!draft.definition.nodes.length) return null;
    if (selectedNodeId) {
      const match = draft.definition.nodes.find((node) => node.id === selectedNodeId);
      if (match) return match;
    }
    return draft.definition.nodes[0];
  }, [draft, selectedNodeId]);

  const disableEditing = draft?.isSystem ?? false;

  return (
    <PageFrame
      eyebrow="Flows"
      title="Call flow atelier"
      description="Design IVR experiences, control prompts and branching logic, then deploy instantly to your campaigns."
    >
      <Toasts />
      <div className="grid gap-6 xl:grid-cols-[340px_1fr_320px]">
        <MotionCard tone="neutral" className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">Flows</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                Manage reusable call journeys.
              </div>
            </div>
            <button
              onClick={startNewFlow}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-emerald-600"
            >
              <Icons.Plus className="h-3.5 w-3.5" />
              New flow
            </button>
          </div>

          {loading ? (
            <div className="mt-6 space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <ShimmerTile key={index} className="h-14 rounded-xl" />
              ))}
            </div>
          ) : flows.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-white/60 bg-white/60 p-6 text-sm text-zinc-500 dark:border-white/10 dark:bg-white/5 dark:text-zinc-400">
              No flows yet. Create your first call flow to get started.
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {flows.map((flow) => {
                const isSelected = draft?.id === flow.id && !draft.isNew;
                const stats = summarizeFlow(flow.definition);
                return (
                  <button
                    key={flow.id}
                    onClick={() => selectFlow(flow.id)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                      isSelected
                        ? "border-emerald-400/50 bg-emerald-500/10 ring-2 ring-emerald-400/40 dark:bg-emerald-500/10"
                        : "border-white/60 bg-white/60 hover:bg-white/90 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                          {flow.name}
                        </div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          {formatTimeAgo(flow.updatedAt)}
                        </div>
                      </div>
                      {flow.isSystem ? (
                        <span className="rounded-full bg-indigo-500/15 px-2.5 py-1 text-[11px] font-semibold text-indigo-500">
                          System
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                      <span>{stats.nodes} nodes</span>
                      {Object.entries(stats.counts).map(([key, value]) => (
                        <span key={key} className="flex items-center gap-1">
                          <span className="inline-flex h-1.5 w-1.5 rounded-full bg-zinc-300" />
                          {key}: {value}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </MotionCard>

        <FlowCanvas
          draft={draft}
          loading={loading}
          selectedNodeId={selectedNodeId}
          onSelectNode={setSelectedNodeId}
          moveNode={moveNode}
          addNode={addNode}
          setEntry={setEntry}
          handleSave={handleSave}
        />

        <MotionCard tone="neutral" className="space-y-6 p-6">
          {!draft ? (
            <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-6 text-sm text-[var(--lux-muted)]">
              Flow details will appear here once a flow is selected.
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-[var(--lux-muted)]">Flow name</label>
                  <input
                    value={draft.name}
                    onChange={(event) => handleNameChange(event.target.value)}
                    disabled={disableEditing && !draft.isNew}
                    className="glass-input mt-1 w-full text-sm disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-[var(--lux-muted)]">Description</label>
                  <textarea
                    value={draft.description}
                    onChange={(event) => handleDescriptionChange(event.target.value)}
                    rows={4}
                    disabled={disableEditing && !draft.isNew}
                    className="glass-input mt-1 w-full text-sm disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-[var(--lux-muted)]">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                  Summary
                </div>
                <div className="mt-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-white/90">
                    <span>Total nodes</span>
                    <span>{summary?.nodes ?? 0}</span>
                  </div>
                  {totals
                    ? Object.entries(totals).map(([type, count]) => (
                        <div key={type} className="flex items-center justify-between">
                          <span className="capitalize text-white/70">{type}</span>
                          <span className="text-white">{count}</span>
                        </div>
                      ))
                    : null}
                </div>
              </div>

              {selectedNode ? (
                <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white">{getNodeLabel(selectedNode)}</div>
                      <div className="text-xs uppercase tracking-[0.3em] text-[var(--lux-muted)]">
                        {selectedNode.type}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => duplicateNode(selectedNode.id)}
                        className="rounded-full border border-white/15 px-3 py-1 text-xs text-[var(--lux-muted)] transition hover:bg-white/10"
                      >
                        Duplicate
                      </button>
                      <button
                        onClick={() => removeNode(selectedNode.id)}
                        className="rounded-full border border-white/15 px-3 py-1 text-xs text-rose-300 transition hover:bg-white/10"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setEntry(selectedNode.id)}
                        className={clsx(
                          "rounded-full px-3 py-1 text-xs",
                          draft.definition.entry === selectedNode.id
                            ? "bg-emerald-500/20 text-emerald-200"
                            : "border border-white/15 text-[var(--lux-muted)] hover:bg-white/10",
                        )}
                      >
                        Entry
                      </button>
                    </div>
                  </div>
                  {renderNodeFields({
                    node: selectedNode,
                    updateNode,
                    uploadAudio,
                  })}
                </div>
              ) : null}

              <div className="space-y-2 text-xs text-[var(--lux-muted)]">
                <div className="flex items-center justify-between">
                  <span>Status</span>
                  <span className="text-white">{draft.dirty ? "Unsaved changes" : "Synced"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Flow ID</span>
                  <span className="text-white">{draft.id ?? "pending"}</span>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleSave}
                  disabled={draft.saving || (!draft.dirty && !draft.isNew)}
                  className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {draft.saving ? "Saving..." : "Save flow"}
                </button>
                <button
                  onClick={handleExport}
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10"
                >
                  <span className="inline-flex items-center gap-2">
                    <Icons.Download className="h-4 w-4" />
                    Export JSON
                  </span>
                </button>
                <button
                  onClick={handleDelete}
                  disabled={!draft.id || draft.isSystem}
                  className="w-full rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="inline-flex items-center gap-2">
                    <Icons.Trash className="h-4 w-4" />
                    Delete flow
                  </span>
                </button>
              </div>
            </>
          )}
        </MotionCard>
      </div>
    </PageFrame>
  );
}

type FlowCanvasProps = {
  draft: FlowDraft | null;
  loading: boolean;
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
  moveNode: (id: string, direction: -1 | 1) => void;
  addNode: (type: NodeType) => void;
  setEntry: (id: string) => void;
  handleSave: () => Promise<void>;
};

function FlowCanvas({
  draft,
  loading,
  selectedNodeId,
  onSelectNode,
  moveNode,
  addNode,
  setEntry,
  handleSave,
}: FlowCanvasProps) {
  if (!draft) {
    return (
      <MotionCard tone="neutral" className="p-6">
        <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-6 text-sm text-[var(--lux-muted)]">
          Select a flow or create a new one to begin editing.
        </div>
      </MotionCard>
    );
  }

  const nodes = draft.definition.nodes;
  const positions = nodes.reduce<Record<string, { x: number; y: number }>>((acc, node, index) => {
    acc[node.id] = {
      x: 360,
      y: 120 + index * 180,
    };
    return acc;
  }, {});

  const edges: Array<{ from: string; to: string; color: string; offset?: number }> = [];
  nodes.forEach((node) => {
    if ("next" in node && node.next && positions[node.next]) {
      edges.push({ from: node.id, to: node.next, color: "#4EF0B0" });
    }
    if (node.type === "gather" && node.branches) {
      Object.entries(node.branches).forEach(([digit, target], index) => {
        if (positions[target]) {
          edges.push({
            from: node.id,
            to: target,
            color: "#a586ff",
            offset: (index % 3) * 40 - 40,
          });
        }
      });
      if (node.defaultNext && positions[node.defaultNext]) {
        edges.push({
          from: node.id,
          to: node.defaultNext,
          color: "#94a3b8",
          offset: 40,
        });
      }
    }
  });

  const canvasHeight = Math.max(nodes.length * 180 + 200, 420);

  const buildPath = (from: string, to: string, offset = 0) => {
    const start = positions[from];
    const end = positions[to];
    if (!start || !end) return "";
    const controlX = (start.x + end.x) / 2 + offset;
    return `M ${start.x} ${start.y} C ${controlX} ${start.y}, ${controlX} ${end.y}, ${end.x + offset} ${end.y}`;
  };

  return (
    <MotionCard tone="neutral" className="p-0">
      <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
        <div>
          <div className="text-sm font-semibold text-white">Flow canvas</div>
          <div className="text-xs text-[var(--lux-muted)]">Drag inspired, click to edit</div>
        </div>
        <button
          onClick={handleSave}
          disabled={draft.saving || (!draft.dirty && !draft.isNew)}
          className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
        >
          <Icons.Save className="h-3.5 w-3.5" />
          {draft.saving ? "Saving..." : "Save"}
        </button>
      </div>

      {loading ? (
        <div className="space-y-3 p-6">
          {Array.from({ length: 4 }).map((_, index) => (
            <ShimmerTile key={index} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <div
            className="relative overflow-hidden border-b border-white/5 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.15),transparent_60%)] p-6"
            style={{ minHeight: canvasHeight }}
          >
            <div className="pointer-events-none absolute inset-0 opacity-[0.25] [background:linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:80px_80px]" />
            <svg className="pointer-events-none absolute inset-0" width="100%" height="100%">
              {edges.map((edge, index) => (
                <path
                  key={`${edge.from}-${edge.to}-${index}`}
                  d={buildPath(edge.from, edge.to, edge.offset)}
                  fill="none"
                  stroke={edge.color}
                  strokeWidth={1.5}
                  strokeOpacity={0.7}
                  strokeDasharray="4 6"
                />
              ))}
            </svg>
            <div className="relative">
              {nodes.map((node, index) => {
                const position = positions[node.id];
                const isSelected = selectedNodeId === node.id;
                const isEntry = draft.definition.entry === node.id;
                return (
                  <div
                    key={node.id}
                    style={{
                      left: position.x - 180,
                      top: position.y - 60,
                    }}
                    className={clsx(
                      "absolute w-80 cursor-pointer rounded-2xl border border-white/10 bg-white/5 p-4 text-white transition hover:border-white/40",
                      isSelected && "border-emerald-400/60 shadow-[0_20px_50px_rgba(5,200,150,0.25)]",
                    )}
                    onClick={() => onSelectNode(node.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold">{getNodeLabel(node)}</div>
                        <div className="text-[10px] uppercase tracking-[0.3em] text-[var(--lux-muted)]">
                          {node.type}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            moveNode(node.id, -1);
                          }}
                          disabled={index === 0}
                          className="rounded-full border border-white/15 p-1 text-[10px] text-white/70 disabled:opacity-30"
                        >
                          <Icons.ArrowUp className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            moveNode(node.id, 1);
                          }}
                          disabled={index === nodes.length - 1}
                          className="rounded-full border border-white/15 p-1 text-[10px] text-white/70 disabled:opacity-30"
                        >
                          <Icons.ArrowDown className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-[var(--lux-muted)]">
                      <span>{node.next ? `Next: ${node.next}` : "Terminal"}</span>
                      {isEntry ? (
                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                          Entry
                        </span>
                      ) : (
                        <button
                          className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] text-white/70"
                          onClick={(event) => {
                            event.stopPropagation();
                            setEntry(node.id);
                          }}
                        >
                          Set entry
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-4 p-6">
            <div className="rounded-2xl border border-dashed border-white/15 p-4 text-sm">
              <div className="text-xs font-medium text-white/80">Add step</div>
              <div className="mt-3 grid gap-2 md:grid-cols-3">
                {NODE_TYPES.map((item) => (
                  <button
                    key={item.type}
                    onClick={() => addNode(item.type)}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-left text-xs text-[var(--lux-muted)] transition hover:border-emerald-400/40 hover:text-white"
                  >
                    <div className="text-sm font-semibold text-white">{item.label}</div>
                    <div className="mt-1 text-[11px]">{item.description}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </MotionCard>
  );
}

type NodeFieldProps = {
  node: FlowNode;
  updateNode: (id: string, mapper: (node: FlowNode) => FlowNode) => void;
  uploadAudio: (file: File) => Promise<any>;
};

function renderNodeFields({ node, updateNode, uploadAudio }: NodeFieldProps) {
  if (node.type === "play") {
    return (
      <PlaybackEditor
        playback={node.playback}
        onChange={(playback) =>
          updateNode(node.id, (prev) => ({
            ...prev,
            playback,
          }))
        }
        uploadAudio={uploadAudio}
      />
    );
  }
  if (node.type === "gather") {
    return (
      <div className="space-y-4">
        <PlaybackEditor
          label="Prompt audio"
          playback={node.prompt ?? createPlayback("tts")}
          onChange={(playback) =>
            updateNode(node.id, (prev) => ({
              ...prev,
              prompt: playback,
            }))
          }
          uploadAudio={uploadAudio}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField
            label="Min digits"
            value={node.minDigits}
            onChange={(value) =>
              updateNode(node.id, (prev) => ({
                ...prev,
                minDigits: value,
              }))
            }
            min={1}
            max={6}
          />
          <NumberField
            label="Max digits"
            value={node.maxDigits}
            onChange={(value) =>
              updateNode(node.id, (prev) => ({
                ...prev,
                maxDigits: value,
              }))
            }
            min={1}
            max={6}
          />
          <NumberField
            label="Attempts"
            value={node.attempts}
            onChange={(value) =>
              updateNode(node.id, (prev) => ({
                ...prev,
                attempts: value,
              }))
            }
            min={1}
            max={5}
          />
          <NumberField
            label="Timeout (seconds)"
            value={node.timeoutSeconds}
            onChange={(value) =>
              updateNode(node.id, (prev) => ({
                ...prev,
                timeoutSeconds: value,
              }))
            }
            min={1}
            max={60}
          />
        </div>
          <div>
            <label className="text-xs font-medium text-[var(--lux-muted)]">
            Variable
          </label>
          <input
            value={node.variable ?? "dtmf"}
            onChange={(event) =>
              updateNode(node.id, (prev) => ({
                ...prev,
                variable: event.target.value,
              }))
            }
              className="glass-input mt-1 w-full text-sm"
          />
        </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-[var(--lux-muted)]">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
            Digit routing
          </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {["1","2","3","4","5","6","7","8","9","0","*","#"].map((digit) => (
            <div key={digit} className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-[var(--lux-muted)]">
                {digit}
              </span>
              <input
                value={node.branches?.[digit] ?? ""}
                onChange={(event) =>
                  updateNode(node.id, (prev) => {
                    const branches = { ...(prev.branches ?? {}) };
                    const value = event.target.value;
                    if (!value) {
                      delete branches[digit];
                    } else {
                      branches[digit] = value;
                    }
                    return {
                      ...prev,
                      branches,
                    };
                  })
                }
                placeholder="Target node ID"
                className="glass-input flex-1 text-xs"
              />
            </div>
          ))}
        </div>
        <div className="mt-3">
          <label className="text-xs font-medium text-[var(--lux-muted)]">
            Default next step
          </label>
          <input
            value={node.defaultNext ?? ""}
            onChange={(event) =>
              updateNode(node.id, (prev) => ({
                ...prev,
                defaultNext: event.target.value || undefined,
              }))
            }
            placeholder="Leave empty to end call"
            className="glass-input mt-1 w-full text-sm"
          />
        </div>
        </div>
      </div>
    );
  }
  if (node.type === "dial") {
    return (
      <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-[var(--lux-muted)]">Endpoint</label>
            <input
              value={node.endpoint}
              onChange={(event) =>
                updateNode(node.id, (prev) => ({
                  ...prev,
                  endpoint: event.target.value,
                }))
              }
              className="glass-input mt-1 w-full text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--lux-muted)]">Caller ID</label>
            <input
              value={node.callerId ?? ""}
              onChange={(event) =>
                updateNode(node.id, (prev) => ({
                  ...prev,
                  callerId: event.target.value || undefined,
                }))
              }
              className="glass-input mt-1 w-full text-sm"
            />
          </div>
        <NumberField
          label="Timeout (seconds)"
          value={node.timeoutSeconds ?? 45}
          onChange={(value) =>
            updateNode(node.id, (prev) => ({
              ...prev,
              timeoutSeconds: value,
            }))
          }
          min={5}
          max={300}
        />
      </div>
    );
  }
  if (node.type === "pause") {
    return (
      <NumberField
        label="Duration (seconds)"
        value={node.durationSeconds}
        onChange={(value) =>
          updateNode(node.id, (prev) => ({
            ...prev,
            durationSeconds: value,
          }))
        }
        min={1}
        max={120}
      />
    );
  }
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-[var(--lux-muted)]">
        No additional settings for this step.
      </div>
    );
}

type PlaybackEditorProps = {
  playback: Playback;
  onChange: (playback: Playback) => void;
  uploadAudio: (file: File) => Promise<any>;
  label?: string;
};

function PlaybackEditor({ playback, onChange, uploadAudio, label }: PlaybackEditorProps) {
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    try {
      setUploading(true);
      const result = await uploadAudio(file);
      onChange({
        mode: "file",
        url: result.url,
        mimeType: result.mimeType ?? file.type,
      });
    } catch (error) {
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const isFile = playback.mode === "file";

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-[var(--lux-muted)]">
          {label ?? "Playback"}
        </div>
        <Switch
          checked={isFile}
          onChange={(checked) => {
            onChange(checked ? createPlayback("file") : createPlayback("tts"));
          }}
          className={`relative inline-flex h-6 w-11 items-center rounded-full ${
            isFile ? "bg-emerald-500" : "bg-zinc-500"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
              isFile ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </Switch>
      </div>

      <Transition
        as={Fragment}
        show
        enter="transition duration-150 ease-out"
        enterFrom="opacity-0 translate-y-2"
        enterTo="opacity-100 translate-y-0"
        leave="transition duration-150 ease-in"
        leaveFrom="opacity-100 translate-y-0"
        leaveTo="opacity-0 translate-y-2"
      >
        <div className="mt-4 space-y-4">
          {isFile ? (
            <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-[var(--lux-muted)]">
                  File URL
                </label>
                <input
                  value={playback.url ?? ""}
                  onChange={(event) =>
                    onChange({
                      ...playback,
                      url: event.target.value,
                    })
                  }
                    placeholder="/uploads/audio/file.wav"
                    className="glass-input mt-1 w-full text-sm"
                />
              </div>
                <label className="glass-pill inline-flex items-center gap-2 px-3 py-2 text-sm text-white transition hover:bg-white/15">
                <Icons.Audio className="h-4 w-4" />
                {uploading ? "Uploading..." : "Upload audio"}
                <input
                  type="file"
                  accept="audio/*"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) handleFile(file);
                    event.target.value = "";
                  }}
                />
              </label>
            </div>
          ) : (
              <>
                <div>
                  <label className="text-xs font-medium text-[var(--lux-muted)]">
                  Text to speak
                </label>
                <textarea
                  value={playback.text ?? ""}
                  onChange={(event) =>
                    onChange({
                      ...playback,
                      text: event.target.value,
                    })
                  }
                    rows={4}
                    className="glass-input mt-1 w-full text-sm"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                    <label className="text-xs font-medium text-[var(--lux-muted)]">
                    Voice
                  </label>
                  <input
                    value={(playback as any).voice ?? "Corporate"}
                    onChange={(event) =>
                      onChange({
                        ...playback,
                        voice: event.target.value,
                      })
                      }
                      className="glass-input mt-1 w-full text-sm"
                  />
                </div>
                <div>
                    <label className="text-xs font-medium text-[var(--lux-muted)]">
                    Language
                  </label>
                  <input
                    value={(playback as any).language ?? "en-US"}
                    onChange={(event) =>
                      onChange({
                        ...playback,
                        language: event.target.value,
                      })
                      }
                      className="glass-input mt-1 w-full text-sm"
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </Transition>
    </div>
  );
}

type NumberFieldProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
};

function NumberField({ label, value, onChange, min, max }: NumberFieldProps) {
  return (
    <div>
      <label className="text-xs font-medium text-[var(--lux-muted)]">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) {
            onChange(Math.min(Math.max(next, min), max));
          }
        }}
        className="glass-input mt-1 w-full text-sm"
      />
    </div>
  );
}
