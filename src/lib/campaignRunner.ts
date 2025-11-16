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

type RunnerState = {
  campaignId: string;
  active: boolean;
  stopRequested: boolean;
  carry: number;
  sessions: Set<string>;
  loop?: Promise<void>;
};

const runners = new Map<string, RunnerState>();

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
      sessions: new Set<string>(),
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

async function reserveLeads(
  campaignId: string,
  take: number
): Promise<CampaignLead[]> {
  if (take <= 0) return [];
  return prisma.$transaction(async (tx) => {
    const leads = await tx.campaignLead.findMany({
      where: {
        campaignId,
        status: { in: leadStatusesForQueue },
      },
      orderBy: { createdAt: "asc" },
      take,
    });

    const reserved: CampaignLead[] = [];
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
        reserved.push(lead);
      }
    }
    return reserved;
  });
}

function releaseSession(state: RunnerState, sessionId: string) {
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
  lead: CampaignLead,
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

  state.sessions.add(session.id);

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
          status: LeadStatus.CONNECTED,
        },
      });
    });
  } catch (error: any) {
    await prisma.$transaction(async (tx) => {
      await tx.callSession.update({
        where: { id: session.id },
        data: {
          status: CallStatus.FAILED,
          error: error?.message ?? "Unable to place call",
          completedAt: new Date(),
        },
      });
      await tx.campaignLead.update({
        where: { id: lead.id },
        data: {
          status: LeadStatus.FAILED,
          error: error?.message ?? "Unable to place call",
        },
      });
      await tx.campaign.update({
        where: { id: campaign.id },
        data: {
          dialedCount: { increment: 1 },
        },
      });
    });
    releaseSession(state, session.id);
  }

  setTimeout(() => {
    const nextState = runners.get(campaign.id);
    if (nextState) {
      releaseSession(nextState, session.id);
    }
  }, (campaign.ringTimeoutSeconds ?? 45) * 1000 + 5000);
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
  });
  if (!session) return;

  const updates: Prisma.CallSessionUpdateInput = {};
  if (payload.status) {
    updates.status = payload.status;
    updates.completedAt = new Date();
    if (payload.status === CallStatus.ANSWERED) {
      updates.answeredAt = new Date();
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

  await prisma.$transaction(async (tx) => {
    await tx.callSession.update({
      where: { id: session.id },
      data: updates,
    });

    const leadUpdate: Prisma.CampaignLeadUpdateInput = {};
    if (payload.status) {
      if (
        payload.status === CallStatus.ANSWERED ||
        payload.status === CallStatus.COMPLETED ||
        payload.status === CallStatus.HUNGUP
      ) {
        leadUpdate.status = LeadStatus.COMPLETED;
      } else if (
        payload.status === CallStatus.FAILED ||
        payload.status === CallStatus.CANCELLED
      ) {
        leadUpdate.status = LeadStatus.FAILED;
      }
    }
    if (hasDigits) {
      leadUpdate.dtmf = payload.dtmf;
    }
    if (Object.keys(leadUpdate).length > 0) {
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

    if (
      payload.status === CallStatus.ANSWERED ||
      payload.status === CallStatus.COMPLETED
    ) {
      await tx.campaign.update({
        where: { id: session.campaignId },
        data: {
          connectedCount: { increment: 1 },
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
  }
  await finalizeIfDone(session.campaignId);
}
