import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { completeCallSession } from "@/lib/campaignRunner";
import { CallStatus, LeadStatus, VoicemailStatus } from "@prisma/client";
import { sendDtmfWebhooks } from "@/lib/webhooks";

const payloadSchema = z.object({
  event: z.string(),
  sessionId: z.string().optional(),
  channelId: z.string().optional(),
  dtmf: z.string().optional(),
  durationSeconds: z.number().int().min(0).optional(),
  recordingUrl: z.string().optional(),
  costCents: z.number().int().min(0).optional(),
  metadata: z.record(z.any()).optional(),
});

const statusMap: Record<string, CallStatus> = {
  "call.answered": CallStatus.ANSWERED,
  "call.completed": CallStatus.COMPLETED,
  "call.failed": CallStatus.FAILED,
  "call.hungup": CallStatus.HUNGUP,
  "call.canceled": CallStatus.CANCELLED,
};
const dtmfEvents = new Set(["call.dtmf"]);
const voicemailEvents = new Set(["call.voicemail"]);

export async function POST(req: Request) {
  try {
    const raw = await req.json();
    const body = payloadSchema.parse(raw);

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

        const currentCount = session.lead?.voicemailCount ?? 0;
        const retryLimit = session.campaign?.voicemailRetryLimit ?? 0;
        const retryEligible =
          typeof body.metadata?.retryEligible === "boolean"
            ? body.metadata.retryEligible
            : currentCount < retryLimit;

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
          await tx.campaignLead.update({
            where: { id: session.leadId },
            data: {
              voicemailCount: { increment: 1 },
              lastVoicemailAt: new Date(),
              status: retryEligible ? LeadStatus.QUEUED : LeadStatus.COMPLETED,
            },
          });
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
    if (error?.issues?.[0]?.message) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to process webhook" }, { status: 400 });
  }
}
