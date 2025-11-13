import {
  CampaignStatus,
  CallStatus,
  LeadStatus,
  Prisma,
  Campaign,
  CampaignLead,
} from "@prisma/client";
import { originateCall } from "./ari";
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

async function dispatchLead(
  campaign: Campaign & {
    route: {
      id: string;
      domain: string;
      outboundUri: string | null;
      trunkPrefix: string | null;
      callerIdFormat: string | null;
      metadata: Prisma.JsonValue | null;
      ringTimeoutSeconds?: number;
    };
  },
  lead: CampaignLead,
  state: RunnerState
) {
  const defaultNumber =
    lead.normalizedNumber ??
    normalizePhoneNumber(lead.phoneNumber) ??
    lead.phoneNumber;
  const dial = toDialable(defaultNumber, campaign.route.trunkPrefix);

  const session = await prisma.callSession.create({
    data: {
      campaignId: campaign.id,
      leadId: lead.id,
      routeId: campaign.route.id,
      status: CallStatus.PLACING,
      callerId: campaign.callerId,
      dialedNumber: dial,
    },
  });

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
      },
      appArgs: [campaign.id, lead.id, session.id],
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
      dispatchLead(campaign, lead, state).catch(() => {});
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
  status: CallStatus;
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

  const updates: Prisma.CallSessionUpdateInput = {
    status: payload.status,
    completedAt: new Date(),
    durationSeconds:
      payload.durationSeconds ?? session.durationSeconds ?? undefined,
    recordingUrl: payload.recordingUrl ?? undefined,
    metadata: payload.metadata ?? undefined,
    costCents: payload.costCents ?? undefined,
  };

  if (payload.status === CallStatus.ANSWERED) {
    updates.answeredAt = new Date();
  }

  await prisma.$transaction(async (tx) => {
    await tx.callSession.update({
      where: { id: session.id },
      data: updates,
    });

    const leadUpdate: Prisma.CampaignLeadUpdateInput = {};
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

    if (Object.keys(leadUpdate).length > 0) {
      await tx.campaignLead.update({
        where: { id: session.leadId },
        data: leadUpdate,
      });
    }

    if (payload.dtmf) {
      await tx.campaignLead.update({
        where: { id: session.leadId },
        data: {
          dtmf: payload.dtmf,
        },
      });
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
