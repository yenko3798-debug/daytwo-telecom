import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { completeCallSession } from "@/lib/campaignRunner";
import { CallStatus, LeadStatus, VoicemailStatus } from "@prisma/client";
import { sendDtmfWebhooks } from "@/lib/webhooks";

const statusMap: Record<string, CallStatus> = {
  "call.answered": CallStatus.ANSWERED,
  "call.completed": CallStatus.COMPLETED,
  "call.failed": CallStatus.FAILED,
  "call.hungup": CallStatus.HUNGUP,
  "call.canceled": CallStatus.CANCELLED,
};
const dtmfEvents = new Set(["call.dtmf"]);
const voicemailEvents = new Set(["call.voicemail"]);

type Payload = {
  event: string;
  sessionId?: string;
  channelId?: string;
  dtmf?: string;
  durationSeconds?: number;
  recordingUrl?: string;
  costCents?: number;
  metadata?: Record<string, any>;
};

function parsePayload(raw: unknown): Payload {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Payload must be an object");
  }
  const value = raw as Record<string, any>;
  if (typeof value.event !== "string" || value.event.length === 0) {
    throw new Error("event is required");
  }
  const payload: Payload = { event: value.event };
  if (typeof value.sessionId === "string" && value.sessionId.length > 0) {
    payload.sessionId = value.sessionId;
  }
  if (typeof value.channelId === "string" && value.channelId.length > 0) {
    payload.channelId = value.channelId;
  }
  if (typeof value.dtmf === "string") {
    payload.dtmf = value.dtmf;
  }
  if (typeof value.durationSeconds === "number" && Number.isFinite(value.durationSeconds) && value.durationSeconds >= 0) {
    payload.durationSeconds = value.durationSeconds;
  }
  if (typeof value.recordingUrl === "string" && value.recordingUrl.length > 0) {
    payload.recordingUrl = value.recordingUrl;
  }
  if (typeof value.costCents === "number" && Number.isFinite(value.costCents) && value.costCents >= 0) {
    payload.costCents = value.costCents;
  }
  if (value.metadata && typeof value.metadata === "object" && !Array.isArray(value.metadata)) {
    payload.metadata = value.metadata as Record<string, any>;
  }
  return payload;
}

export async function POST(req: Request) {
  try {
    const raw = await req.json().catch(() => null);
    const body = parsePayload(raw);

      const status = statusMap[body.event];
      const isDtmfEvent = dtmfEvents.has(body.event);
      const isVoicemailEvent = voicemailEvents.has(body.event);
      if (!status && !isDtmfEvent && !isVoicemailEvent) {
      return NextResponse.json({ error: "Unsupported event" }, { status: 400 });
    }

    let sessionId = body.sessionId ?? null;
    if (!sessionId && body.channelId) {
      const session = await prisma.callSession.findFirst({
        where: { ariChannelId: body.channelId },
        select: { id: true },
      });
      if (session) sessionId = session.id;
    }

    if (!sessionId) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

      if (isDtmfEvent) {
        if (!body.dtmf || body.dtmf.length === 0) {
          return NextResponse.json({ error: "DTMF digits required" }, { status: 400 });
        }
        await completeCallSession(sessionId, {
          dtmf: body.dtmf,
          metadata: body.metadata ?? null,
        });
        sendDtmfWebhooks(sessionId, body.dtmf).catch((error) => {
          console.error(`DTMF webhook dispatch failed: ${error?.message ?? error}`);
        });
        return NextResponse.json({ ok: true });
      }

        if (isVoicemailEvent) {
        const session = await prisma.callSession.findUnique({
          where: { id: sessionId },
          select: {
            id: true,
              leadId: true,
              campaignId: true,
            metadata: true,
            campaign: {
              select: { voicemailRetryLimit: true },
            },
            lead: {
              select: { voicemailCount: true },
            },
          },
        });
        if (!session) {
          return NextResponse.json({ error: "Session not found" }, { status: 404 });
        }

          const hasLead = Boolean(session.leadId);
          const currentCount = session.lead?.voicemailCount ?? 0;
          const retryLimit = session.campaign?.voicemailRetryLimit ?? 0;
          const retryEligible =
            typeof body.metadata?.retryEligible === "boolean"
              ? body.metadata.retryEligible
              : hasLead && currentCount < retryLimit;

        const existingMeta =
          session.metadata && typeof session.metadata === "object" && !Array.isArray(session.metadata)
            ? (session.metadata as Record<string, any>)
            : {};
        const voicemailResult = {
          detectedAt: new Date().toISOString(),
          detection: body.metadata?.detection ?? null,
          retryEligible,
          attempt: currentCount + 1,
        };

          await prisma.$transaction(async (tx) => {
          await tx.callSession.update({
            where: { id: sessionId },
            data: {
              status: CallStatus.FAILED,
              completedAt: new Date(),
              metadata: { ...existingMeta, voicemailResult },
              voicemailStatus: retryEligible ? VoicemailStatus.RETRYING : VoicemailStatus.MACHINE,
              voicemailScore:
                typeof body.metadata?.score === "number" ? body.metadata.score : undefined,
            },
          });
            if (hasLead) {
              await tx.campaignLead.update({
                where: { id: session.leadId! },
                data: {
                  voicemailCount: { increment: 1 },
                  lastVoicemailAt: new Date(),
                  status: retryEligible ? LeadStatus.QUEUED : LeadStatus.COMPLETED,
                },
              });
            }
        });

        return NextResponse.json({ ok: true, retry: retryEligible });
      }

    await completeCallSession(sessionId, {
      status,
      dtmf: body.dtmf ?? null,
      durationSeconds: body.durationSeconds,
      recordingUrl: body.recordingUrl ?? null,
      costCents: body.costCents ?? null,
      metadata: body.metadata ?? null,
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("ARI webhook error", error);
    if (error?.issues?.[0]?.message) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: error?.message ?? "Unable to process webhook" }, { status: 400 });
  }
}
