import {
  CampaignStatus,
  CallStatus,
  LeadStatus,
  Prisma,
  Campaign,
  CampaignLead,
  AdjustmentType,
  AdjustmentSource,
} from "@prisma/client";
import { createHash } from "crypto";
import { originateCall } from "./ari";
import { FlowDefinitionSchema, RATE_PER_LEAD_CENTS, summarizeFlow } from "./flows";
import { prisma } from "./prisma";
import { normalizePhoneNumber, toDialable } from "./phone";

type SessionTracker = {
  leadId: string;
  attemptNumber: number;
  guard?: NodeJS.Timeout;
};

type RetryEntry = {
  leadId: string;
  campaignId: string;
  availableAt: number;
};

type RunnerState = {
  campaignId: string;
  active: boolean;
  stopRequested: boolean;
  carry: number;
  sessions: Map<string, SessionTracker>;
  retryQueue: RetryEntry[];
  lastPausedSweep: number;
  loop?: Promise<void>;
};

const runners = new Map<string, RunnerState>();
const MAX_LEAD_ATTEMPTS = Math.max(
  1,
  Number.parseInt(process.env.CAMPAIGN_MAX_ATTEMPTS ?? "3", 10)
);
const RETRY_DELAY_MS = Math.max(5000, Number.parseInt(process.env.CAMPAIGN_RETRY_DELAY_MS ?? "30000", 10));
const RING_GUARD_GRACE_MS = Math.max(2000, Number.parseInt(process.env.CALL_RING_GUARD_GRACE_MS ?? "10000", 10));
const STALE_SESSION_WINDOW_MS = Math.max(
  RING_GUARD_GRACE_MS,
  Number.parseInt(process.env.CALL_STALE_WINDOW_MS ?? "120000", 10)
);
const STALE_STATUSES = new Set<CallStatus>([CallStatus.PLACING, CallStatus.RINGING]);

const leadStatusesForQueue = [LeadStatus.PENDING, LeadStatus.QUEUED];

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getState(campaignId: string) {
  let state = runners.get(campaignId);
  if (!state) {
    state = {
      campaignId,
      active: true,
      stopRequested: false,
      carry: 0,
      sessions: new Map<string, SessionTracker>(),
      retryQueue: [],
      lastPausedSweep: 0,
    };
    runners.set(campaignId, state);
  }
  return state;
}

export function getRunnerSnapshot() {
  return Array.from(runners.values()).map((state) => ({
    campaignId: state.campaignId,
    active: state.active,
    stopRequested: state.stopRequested,
    inFlight: state.sessions.size,
    carry: state.carry,
  }));
}

type ReservedLead = CampaignLead & { attemptNumber: number };

async function reserveLeads(
  campaignId: string,
  take: number
): Promise<ReservedLead[]> {
  if (take <= 0) return [];
  return prisma.$transaction(async (tx) => {
    const leads = await tx.campaignLead.findMany({
      where: {
        campaignId,
        status: { in: leadStatusesForQueue },
      },
      orderBy: [
        { attempts: "asc" },
        { lastDialedAt: "asc" },
        { createdAt: "asc" },
      ],
      take,
    });

    const reserved: ReservedLead[] = [];
    for (const lead of leads) {
      const updated = await tx.campaignLead.updateMany({
        where: {
          id: lead.id,
          status: { in: leadStatusesForQueue },
        },
        data: {
          status: LeadStatus.DIALING,
          attempts: { increment: 1 },
          lastDialedAt: new Date(),
        },
      });
      if (updated.count > 0) {
        reserved.push({ ...lead, attemptNumber: lead.attempts + 1 });
      }
    }
    return reserved;
  });
}

function releaseSession(state: RunnerState, sessionId: string) {
  const tracker = state.sessions.get(sessionId);
  if (tracker?.guard) {
    clearTimeout(tracker.guard);
  }
  if (state.sessions.delete(sessionId) && state.sessions.size === 0) {
    state.carry = Math.max(0, state.carry);
  }
}

async function finalizeIfDone(campaignId: string) {
  const remaining = await prisma.campaignLead.count({
    where: {
      campaignId,
      status: {
        in: [
          LeadStatus.PENDING,
          LeadStatus.QUEUED,
          LeadStatus.DIALING,
          LeadStatus.CONNECTED,
        ],
      },
    },
  });
  const state = runners.get(campaignId);
  if (remaining === 0 && (!state || state.sessions.size === 0)) {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: CampaignStatus.COMPLETED,
        completedAt: new Date(),
      },
    });
    runners.delete(campaignId);
  }
}

function shouldRetryAttempt(attemptNumber: number) {
  return attemptNumber < MAX_LEAD_ATTEMPTS;
}

async function applyLeadRetry(
  tx: Prisma.TransactionClient,
  leadId: string,
  attemptNumber: number,
  reason: string
) {
  const retry = shouldRetryAttempt(attemptNumber);
  await tx.campaignLead.update({
    where: { id: leadId },
    data: {
      status: retry ? LeadStatus.PAUSED : LeadStatus.FAILED,
      error: reason,
    },
  });
  return retry;
}

function enqueueRetry(state: RunnerState | undefined, campaignId: string, leadId: string) {
  if (!state) return;
  state.retryQueue.push({
    leadId,
    campaignId,
    availableAt: Date.now() + RETRY_DELAY_MS,
  });
}

async function flushRetryQueue(state: RunnerState) {
  if (state.retryQueue.length === 0) return;
  const now = Date.now();
  const readyIds = state.retryQueue.filter((entry) => entry.availableAt <= now).map((entry) => entry.leadId);
  if (readyIds.length === 0) {
    state.retryQueue = state.retryQueue.filter((entry) => entry.availableAt > now);
    return;
  }
  const remaining = state.retryQueue.filter((entry) => entry.availableAt > now);
  state.retryQueue = remaining;
  const uniqueIds = Array.from(new Set(readyIds));
  await prisma.campaignLead.updateMany({
    where: {
      id: { in: uniqueIds },
      status: LeadStatus.PAUSED,
    },
    data: {
      status: LeadStatus.QUEUED,
    },
  });
}

async function releasePausedLeads(state: RunnerState) {
  const now = Date.now();
  if (now - state.lastPausedSweep < RETRY_DELAY_MS) {
    return;
  }
  state.lastPausedSweep = now;
  const threshold = new Date(now - RETRY_DELAY_MS);
  const paused = await prisma.campaignLead.findMany({
    where: {
      campaignId: state.campaignId,
      status: LeadStatus.PAUSED,
      updatedAt: { lt: threshold },
    },
    select: { id: true },
    take: 100,
  });
  if (!paused.length) return;
  await prisma.campaignLead.updateMany({
    where: {
      id: { in: paused.map((lead) => lead.id) },
      status: LeadStatus.PAUSED,
    },
    data: { status: LeadStatus.QUEUED },
  });
}

async function handleSessionTimeout(state: RunnerState, sessionId: string, reason: string) {
  const tracker = state.sessions.get(sessionId);
  if (!tracker) return;
  try {
    const session = await prisma.callSession.findUnique({
      where: { id: sessionId },
      select: { id: true, status: true, campaignId: true },
    });
    if (!session || !STALE_STATUSES.has(session.status as CallStatus)) {
      return;
    }
    await prisma.$transaction(async (tx) => {
      await tx.callSession.update({
        where: { id: sessionId },
        data: {
          status: CallStatus.FAILED,
          error: reason,
          completedAt: new Date(),
        },
      });
      const retry = await applyLeadRetry(tx, tracker.leadId, tracker.attemptNumber, reason);
      if (retry) {
        enqueueRetry(state, session.campaignId, tracker.leadId);
      }
    });
  } finally {
    releaseSession(state, sessionId);
  }
}

async function expireStaleSessions(state: RunnerState) {
  const threshold = new Date(Date.now() - STALE_SESSION_WINDOW_MS);
  const stale = await prisma.callSession.findMany({
    where: {
      campaignId: state.campaignId,
      status: { in: Array.from(STALE_STATUSES) },
      OR: [
        { startedAt: { lt: threshold } },
        { startedAt: null, requestedAt: { lt: threshold } },
      ],
    },
    select: {
      id: true,
      leadId: true,
      campaignId: true,
      lead: { select: { attempts: true } },
    },
    take: 25,
  });
  if (!stale.length) return;
  for (const session of stale) {
    const attemptNumber = session.lead?.attempts ?? MAX_LEAD_ATTEMPTS;
    await prisma.$transaction(async (tx) => {
      await tx.callSession.update({
        where: { id: session.id },
        data: {
          status: CallStatus.FAILED,
          error: "Carrier did not answer",
          completedAt: new Date(),
        },
      });
      const retry = await applyLeadRetry(tx, session.leadId, attemptNumber, "Carrier did not answer");
      if (retry) {
        enqueueRetry(state, session.campaignId, session.leadId);
      }
    });
    if (state.sessions.has(session.id)) {
      releaseSession(state, session.id);
    }
  }
}

type CampaignWithContext = Campaign & {
  route: {
    id: string;
    domain: string;
    outboundUri: string | null;
    trunkPrefix: string | null;
    callerIdFormat: string | null;
    metadata: Prisma.JsonValue | null;
    ringTimeoutSeconds?: number;
  };
  callFlow: {
    id: string;
    name: string;
    definition: Prisma.JsonValue;
    metadata: Prisma.JsonValue | null;
    updatedAt: Date;
  } | null;
  metadata: Prisma.JsonValue | null;
};

function resolveFlowContext(campaign: CampaignWithContext) {
  const campaignMeta =
    campaign.metadata && typeof campaign.metadata === "object" && !Array.isArray(campaign.metadata)
      ? (campaign.metadata as Record<string, any>)
      : undefined;
  const snapshot = campaignMeta?.flow;

  const callFlowMeta =
    campaign.callFlow?.metadata &&
    typeof campaign.callFlow.metadata === "object" &&
    !Array.isArray(campaign.callFlow.metadata)
      ? (campaign.callFlow.metadata as Record<string, any>)
      : undefined;

  const definitionSource =
    snapshot?.definition ?? campaign.callFlow?.definition ?? null;
  if (!definitionSource) return null;

  const definition = FlowDefinitionSchema.parse(definitionSource);
  const summary = snapshot?.summary ?? callFlowMeta?.summary ?? summarizeFlow(definition);
  const version =
    snapshot?.version ??
    callFlowMeta?.summary?.version ??
    campaign.callFlow?.updatedAt.toISOString() ??
    new Date().toISOString();
  const flowId = snapshot?.id ?? campaign.callFlow?.id ?? campaign.callFlowId;
  const checksum = createHash("sha256").update(JSON.stringify(definition)).digest("hex");

  return {
    id: flowId,
    definition,
    summary,
    version,
    checksum,
  };
}

async function dispatchLead(
  campaign: CampaignWithContext,
  lead: ReservedLead,
  state: RunnerState
) {
  const defaultNumber =
    lead.normalizedNumber ??
    normalizePhoneNumber(lead.phoneNumber) ??
    lead.phoneNumber;
  const dial = toDialable(defaultNumber, campaign.route.trunkPrefix);

  const flowContext = resolveFlowContext(campaign);
  if (!flowContext) {
    await prisma.$transaction(async (tx) => {
      await tx.campaignLead.update({
        where: { id: lead.id },
        data: {
          status: LeadStatus.FAILED,
          error: "Call flow definition unavailable",
        },
      });
      await tx.campaign.update({
        where: { id: campaign.id },
        data: {
          status: CampaignStatus.FAILED,
          stopReason: "Call flow definition unavailable",
        },
      });
    });
    state.active = false;
    state.stopRequested = true;
    return;
  }

  let session;
  const attemptNumber = lead.attemptNumber ?? lead.attempts + 1;
  try {
    session = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: campaign.userId },
        select: { balanceCents: true },
      });
      if (!user || user.balanceCents < RATE_PER_LEAD_CENTS) {
        throw new Error("INSUFFICIENT_FUNDS");
      }

      const sessionRecord = await tx.callSession.create({
        data: {
          campaignId: campaign.id,
          leadId: lead.id,
          routeId: campaign.route.id,
          status: CallStatus.PLACING,
          callerId: campaign.callerId,
          dialedNumber: dial,
          metadata: {
            flow: {
              id: flowContext.id,
              version: flowContext.version,
              summary: flowContext.summary,
              checksum: flowContext.checksum,
              definition: flowContext.definition,
            },
            rate: {
              perLeadCents: RATE_PER_LEAD_CENTS,
            },
          },
        },
      });

      await tx.user.update({
        where: { id: campaign.userId },
        data: { balanceCents: { decrement: RATE_PER_LEAD_CENTS } },
      });

      await tx.balanceAdjustment.create({
        data: {
          userId: campaign.userId,
          amountCents: RATE_PER_LEAD_CENTS,
          type: AdjustmentType.DEBIT,
          source: AdjustmentSource.CAMPAIGN_CHARGE,
          reason: `Campaign ${campaign.name} lead charge`,
          referenceId: sessionRecord.id,
          metadata: {
            campaignId: campaign.id,
            leadId: lead.id,
            dialedNumber: dial,
          },
        },
      });

      return sessionRecord;
    });
  } catch (error: any) {
    const message = error?.message ?? "Unable to reserve session";
    if (message === "INSUFFICIENT_FUNDS") {
      await prisma.$transaction(async (tx) => {
        await tx.campaignLead.update({
          where: { id: lead.id },
          data: {
            status: LeadStatus.PENDING,
            error: "Insufficient balance",
          },
        });
        await tx.campaign.update({
          where: { id: campaign.id },
          data: {
            status: CampaignStatus.PAUSED,
            stopReason: "Insufficient balance",
          },
        });
      });
      state.stopRequested = true;
      state.active = false;
      return;
    }

    await prisma.campaignLead.update({
      where: { id: lead.id },
      data: {
        status: LeadStatus.FAILED,
        error: message,
      },
    });
    return;
  }

  state.sessions.set(session.id, { leadId: lead.id, attemptNumber });

  try {
    const result = await originateCall({
      route: campaign.route,
      dialString: dial,
      callerId: campaign.callerId,
      timeoutSeconds: campaign.ringTimeoutSeconds ?? 45,
      variables: {
        campaign_id: campaign.id,
        lead_id: lead.id,
        session_id: session.id,
        flow_id: flowContext.id,
        flow_version: flowContext.version,
      },
      appArgs: [campaign.id, lead.id, session.id, flowContext.id, flowContext.version],
    });

    await prisma.$transaction(async (tx) => {
      await tx.callSession.update({
        where: { id: session.id },
        data: {
          status: CallStatus.RINGING,
          ariChannelId: result.channelId,
          startedAt: new Date(),
        },
      });
      await tx.campaign.update({
        where: { id: campaign.id },
        data: {
          dialedCount: { increment: 1 },
        },
      });
      await tx.campaignLead.update({
        where: { id: lead.id },
        data: {
          status: LeadStatus.DIALING,
          error: null,
        },
      });
    });
    const tracker = state.sessions.get(session.id);
    if (tracker) {
      const guardAfter =
        (campaign.ringTimeoutSeconds ?? 45) * 1000 + RING_GUARD_GRACE_MS;
      tracker.guard = setTimeout(() => {
        handleSessionTimeout(state, session.id, "Dial timed out before answer").catch(() => {});
      }, guardAfter);
      if (typeof tracker.guard.unref === "function") {
        tracker.guard.unref();
      }
    }
  } catch (error: any) {
    const failureReason = error?.message ?? "Unable to place call";
    let willRetry = false;
    await prisma.$transaction(async (tx) => {
      await tx.callSession.update({
        where: { id: session.id },
        data: {
          status: CallStatus.FAILED,
          error: failureReason,
          completedAt: new Date(),
        },
      });
      await tx.campaign.update({
        where: { id: campaign.id },
        data: {
          dialedCount: { increment: 1 },
        },
      });
      willRetry = await applyLeadRetry(tx, lead.id, attemptNumber, failureReason);
    });
    if (willRetry) {
      enqueueRetry(state, campaign.id, lead.id);
    }
    releaseSession(state, session.id);
  }

}

async function runLoop(state: RunnerState) {
  while (state.active && !state.stopRequested) {
    const campaign = await prisma.campaign.findUnique({
      where: { id: state.campaignId },
      include: {
        route: true,
        callFlow: {
          select: {
            id: true,
            name: true,
            definition: true,
            metadata: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!campaign) {
      runners.delete(state.campaignId);
      return;
    }

    if (campaign.status !== CampaignStatus.RUNNING) {
      state.active = false;
      break;
    }

    await flushRetryQueue(state);
    await releasePausedLeads(state);
    await expireStaleSessions(state);

    const perSecond = Math.max(campaign.callsPerMinute / 60, 0);
    state.carry += perSecond;
    const availableSlots = Math.max(
      0,
      campaign.maxConcurrentCalls - state.sessions.size
    );
    const toSchedule = Math.min(
      availableSlots,
      Math.floor(state.carry)
    );

    if (toSchedule <= 0) {
      await delay(1000);
      continue;
    }

    const leads = await reserveLeads(campaign.id, toSchedule);
    if (leads.length === 0) {
      await finalizeIfDone(campaign.id);
      await delay(1500);
      continue;
    }

    state.carry -= leads.length;

    for (const lead of leads) {
      dispatchLead(campaign as CampaignWithContext, lead, state).catch(() => {});
      await delay(50);
    }
  }
}

export async function startCampaignEngine(campaignId: string) {
  const state = getState(campaignId);
  state.stopRequested = false;
  state.active = true;

  const existing = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { startedAt: true },
  });
  const update: Prisma.CampaignUpdateInput = {
    status: CampaignStatus.RUNNING,
  };
  if (!existing?.startedAt) {
    update.startedAt = new Date();
  }

  await prisma.campaign.update({
    where: { id: campaignId },
    data: update,
  });

  if (!state.loop) {
    state.loop = runLoop(state)
      .catch(() => {})
      .finally(() => {
        state.loop = undefined;
        if (!state.active) {
          runners.delete(campaignId);
        }
      });
  }
}

export async function pauseCampaignEngine(campaignId: string) {
  const state = getState(campaignId);
  state.stopRequested = true;
  state.active = false;
  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      status: CampaignStatus.PAUSED,
    },
  });
}

export async function stopCampaignEngine(campaignId: string, reason?: string) {
  const state = getState(campaignId);
  state.stopRequested = true;
  state.active = false;
  runners.delete(campaignId);
  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      status: CampaignStatus.STOPPED,
      stopReason: reason ?? "Stopped by user",
    },
  });
}

type CompletionPayload = {
  status?: CallStatus;
  durationSeconds?: number;
  dtmf?: string | null;
  recordingUrl?: string | null;
  costCents?: number | null;
  metadata?: Prisma.JsonValue;
};

export async function completeCallSession(
  sessionId: string,
  payload: CompletionPayload
) {
  const session = await prisma.callSession.findUnique({
    where: { id: sessionId },
    include: {
      lead: { select: { attempts: true } },
    },
  });
  if (!session) return;

  const updates: Prisma.CallSessionUpdateInput = {};
  const now = new Date();
  if (payload.status) {
    updates.status = payload.status;
    if (payload.status === CallStatus.ANSWERED) {
      updates.answeredAt = now;
    } else {
      updates.completedAt = now;
      if (
        (payload.status === CallStatus.COMPLETED || payload.status === CallStatus.HUNGUP) &&
        !session.answeredAt
      ) {
        updates.answeredAt = now;
      }
    }
  }
  const duration =
    payload.durationSeconds ?? session.durationSeconds ?? undefined;
  if (typeof duration === "number") {
    updates.durationSeconds = duration;
  }
  if (payload.recordingUrl !== undefined) {
    updates.recordingUrl = payload.recordingUrl ?? undefined;
  }
  if (payload.metadata !== undefined) {
    updates.metadata = payload.metadata ?? undefined;
  }
  if (payload.costCents !== undefined) {
    updates.costCents = payload.costCents ?? undefined;
  }
  const hasDigits = typeof payload.dtmf === "string" && payload.dtmf.length > 0;
  if (hasDigits) {
    updates.dtmf = payload.dtmf;
  }

  const attemptNumber = session.lead?.attempts ?? MAX_LEAD_ATTEMPTS;
  const failureReason =
    payload.metadata && typeof payload.metadata === "object"
      ? (payload.metadata as Record<string, any>).error ??
        (payload.metadata as Record<string, any>).message ??
        "Call failed"
      : payload.status
        ? `Call ${payload.status.toLowerCase()}`
        : "Call failed";
  let scheduledRetry = false;
  await prisma.$transaction(async (tx) => {
    await tx.callSession.update({
      where: { id: session.id },
      data: updates,
    });

    let leadUpdatedViaRetry = false;
    const leadUpdate: Prisma.CampaignLeadUpdateInput = {};
    if (payload.status) {
      if (
        payload.status === CallStatus.ANSWERED ||
        payload.status === CallStatus.COMPLETED ||
        payload.status === CallStatus.HUNGUP
      ) {
        leadUpdate.status =
          payload.status === CallStatus.ANSWERED
            ? LeadStatus.CONNECTED
            : LeadStatus.COMPLETED;
      } else if (payload.status === CallStatus.CANCELLED) {
        leadUpdate.status = LeadStatus.FAILED;
      } else if (payload.status === CallStatus.FAILED) {
        leadUpdatedViaRetry = true;
        scheduledRetry = await applyLeadRetry(
          tx,
          session.leadId,
          attemptNumber,
          failureReason
        );
      }
    }
    if (hasDigits) {
      leadUpdate.dtmf = payload.dtmf;
    }
    if (!leadUpdatedViaRetry && Object.keys(leadUpdate).length > 0) {
      await tx.campaignLead.update({
        where: { id: session.leadId },
        data: leadUpdate,
      });
    }
    if (hasDigits && !session.dtmf) {
      await tx.campaign.update({
        where: { id: session.campaignId },
        data: {
          dtmfCount: { increment: 1 },
        },
      });
    }

    if (payload.status === CallStatus.ANSWERED) {
      await tx.campaign.update({
        where: { id: session.campaignId },
        data: {
          connectedCount: { increment: 1 },
        },
      });
    } else if (payload.status === CallStatus.COMPLETED) {
      await tx.campaign.update({
        where: { id: session.campaignId },
        data: {
          connectedCount: session.answeredAt ? undefined : { increment: 1 },
          costCents: payload.costCents
            ? { increment: payload.costCents }
            : undefined,
        },
      });
    } else if (payload.costCents) {
      await tx.campaign.update({
        where: { id: session.campaignId },
        data: {
          costCents: { increment: payload.costCents },
        },
      });
    }
  });

  const state = runners.get(session.campaignId);
  if (state) {
    releaseSession(state, session.id);
    if (scheduledRetry) {
      enqueueRetry(state, session.campaignId, session.leadId);
    }
  } else if (scheduledRetry) {
    const timer = setTimeout(() => {
      prisma.campaignLead
        .updateMany({
          where: { id: session.leadId, status: LeadStatus.PAUSED },
          data: { status: LeadStatus.QUEUED },
        })
        .catch(() => {});
    }, RETRY_DELAY_MS);
    if (typeof timer.unref === "function") {
      timer.unref();
    }
  }
  await finalizeIfDone(session.campaignId);
}
