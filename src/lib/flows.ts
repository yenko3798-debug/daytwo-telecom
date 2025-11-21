import { z } from "zod";

const PlaybackTtsSchema = z.object({
  mode: z.literal("tts"),
  text: z.string().min(1).max(2000),
  voice: z.string().min(1).max(64).optional(),
  language: z.string().min(2).max(8).optional(),
  engine: z.string().min(1).max(32).optional(),
});

const PlaybackFileSchema = z.object({
  mode: z.literal("file"),
  url: z.string().min(1).max(512),
  mimeType: z.string().min(3).max(80).optional(),
  durationSeconds: z.number().int().min(0).max(3600).optional(),
});

export const PlaybackSchema = z.discriminatedUnion("mode", [PlaybackTtsSchema, PlaybackFileSchema]);

const BaseNodeSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-_]{1,63}$/i),
  name: z.string().min(2).max(120).optional(),
  description: z.string().max(240).optional(),
});

const PlayNodeSchema = BaseNodeSchema.extend({
  type: z.literal("play"),
  playback: PlaybackSchema,
  next: z.string().optional(),
});

const GatherNodeSchema = BaseNodeSchema.extend({
  type: z.literal("gather"),
  prompt: PlaybackSchema.optional(),
  maxDigits: z.number().int().min(1).max(6).default(1),
  minDigits: z.number().int().min(1).max(6).default(1),
  timeoutSeconds: z.number().int().min(1).max(120).default(5),
  attempts: z.number().int().min(1).max(5).default(1),
  variable: z.string().min(1).max(32).default("dtmf"),
  branches: z.record(z.string().regex(/^[0-9*#]$/), z.string()).default({}),
  defaultNext: z.string().optional(),
});

const DialNodeSchema = BaseNodeSchema.extend({
  type: z.literal("dial"),
  endpoint: z.string().min(2).max(160),
  callerId: z.string().min(2).max(32).optional(),
  timeoutSeconds: z.number().int().min(5).max(300).optional(),
  next: z.string().optional(),
});

const PauseNodeSchema = BaseNodeSchema.extend({
  type: z.literal("pause"),
  durationSeconds: z.number().int().min(1).max(600),
  next: z.string().optional(),
});

const HangupNodeSchema = BaseNodeSchema.extend({
  type: z.literal("hangup"),
  reason: z.string().max(64).optional(),
});

const ActivityNodeSchema = BaseNodeSchema.extend({
  type: z.literal("activity"),
  humanDigit: z.string().regex(/^[0-9*#]$/).default("1"),
  next: z.string().optional(),
  defaultNext: z.string().optional(),
});

export const FlowNodeSchema = z.discriminatedUnion("type", [
  PlayNodeSchema,
  GatherNodeSchema,
  DialNodeSchema,
  PauseNodeSchema,
  HangupNodeSchema,
  ActivityNodeSchema,
]);

const FlowDefinitionCore = z.object({
  name: z.string().min(2).max(120),
  version: z.string().min(1).max(24).optional(),
  entry: z.string(),
  metadata: z
    .object({
      tags: z.array(z.string().min(1).max(32)).max(16).optional(),
      author: z.string().min(1).max(120).optional(),
      createdWith: z.string().max(64).optional(),
    })
    .passthrough()
    .optional(),
  nodes: FlowNodeSchema.array().min(1),
});

export const FlowDefinitionSchema = FlowDefinitionCore.superRefine((value, ctx) => {
  const ids = new Set<string>();
  value.nodes.forEach((node) => ids.add(node.id));

  if (!ids.has(value.entry)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Entry node ${value.entry} does not exist`,
      path: ["entry"],
    });
  }

  for (const node of value.nodes) {
    if ("next" in node && node.next && !ids.has(node.next)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Node ${node.id} references missing next node ${node.next}`,
        path: ["nodes", value.nodes.indexOf(node), "next"],
      });
    }
    if (node.type === "gather" || node.type === "activity") {
      if ("branches" in node && node.branches) {
        for (const [digit, target] of Object.entries(node.branches)) {
          if (!ids.has(target)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Node ${node.id} branch ${digit} targets missing node ${target}`,
              path: ["nodes", value.nodes.indexOf(node), "branches", digit],
            });
          }
        }
      }
      if (node.defaultNext && !ids.has(node.defaultNext)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Node ${node.id} defaultNext targets missing node ${node.defaultNext}`,
          path: ["nodes", value.nodes.indexOf(node), "defaultNext"],
        });
      }
    }
  }
});

export type FlowDefinition = z.infer<typeof FlowDefinitionSchema>;
export type FlowNode = z.infer<typeof FlowNodeSchema>;
export type Playback = z.infer<typeof PlaybackSchema>;

export const RATE_PER_1000_LEADS_CENTS = 10000;
export const RATE_PER_LEAD_CENTS = Math.round(RATE_PER_1000_LEADS_CENTS / 1000);

export function summarizeFlow(definition: FlowDefinition) {
  const counts = definition.nodes.reduce(
    (acc, node) => {
      acc[node.type] = (acc[node.type] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  return {
    name: definition.name,
    version: definition.version ?? "1.0.0",
    nodes: definition.nodes.length,
    counts,
  };
}
