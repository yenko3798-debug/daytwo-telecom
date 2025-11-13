import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { completeCallSession } from "@/lib/campaignRunner";
import { CallStatus } from "@prisma/client";

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

export async function POST(req: Request) {
  try {
    const raw = await req.json();
    const body = payloadSchema.parse(raw);

    const status = statusMap[body.event];
    if (!status) {
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
