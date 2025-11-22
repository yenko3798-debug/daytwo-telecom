import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { FlowDefinitionSchema } from "@/lib/flows";

export const runtime = "nodejs";

function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

function verifyToken(request: Request) {
  const token = request.headers.get("x-ari-token");
  const expected = process.env.ARI_INTERNAL_TOKEN;
  if (!expected) {
    throw new Error("ARI_INTERNAL_TOKEN is not set");
  }
  return token && token === expected;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!verifyToken(request)) return forbidden();
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Server misconfigured" }, { status: 500 });
  }

  const { id } = await params;

    const session = await prisma.callSession.findUnique({
      where: { id },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            metadata: true,
            callFlowId: true,
            callerId: true,
            ringTimeoutSeconds: true,
            callsPerMinute: true,
            maxConcurrentCalls: true,
            userId: true,
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
        },
        lead: {
          select: {
            id: true,
            phoneNumber: true,
            normalizedNumber: true,
            metadata: true,
          },
        },
        route: {
          select: {
            id: true,
            name: true,
            domain: true,
            trunkPrefix: true,
            outboundUri: true,
            metadata: true,
          },
        },
      },
    });

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const campaignMeta =
    session.campaign.metadata &&
    typeof session.campaign.metadata === "object" &&
    !Array.isArray(session.campaign.metadata)
      ? (session.campaign.metadata as Record<string, any>)
      : undefined;
  const sessionMeta =
    session.metadata &&
    typeof session.metadata === "object" &&
    !Array.isArray(session.metadata)
      ? (session.metadata as Record<string, any>)
      : undefined;

    const flowSnapshot =
      (sessionMeta?.flow?.definition && sessionMeta.flow) ||
      (campaignMeta?.flow?.definition && campaignMeta.flow) ||
      (session.campaign.callFlow?.definition
        ? {
            id: session.campaign.callFlow.id,
            version: session.campaign.callFlow.updatedAt.toISOString(),
            summary:
              session.campaign.callFlow.metadata &&
              typeof session.campaign.callFlow.metadata === "object" &&
              !Array.isArray(session.campaign.callFlow.metadata)
                ? (session.campaign.callFlow.metadata as Record<string, any>).summary ?? null
                : null,
            definition: session.campaign.callFlow.definition as Record<string, any>,
          }
        : null);

    let flow = null;
    if (flowSnapshot?.definition) {
      const normalized = JSON.parse(JSON.stringify(flowSnapshot.definition));
      const parsed = FlowDefinitionSchema.safeParse(normalized);
      if (parsed.success) {
        flow = parsed.data;
      } else {
        console.error(
          `Flow definition invalid for session ${session.id}: ${parsed.error.message}`
        );
        flow = normalized;
      }
    }

  return NextResponse.json({
    session: {
      id: session.id,
      status: session.status.toLowerCase(),
      callerId: session.callerId,
      dialedNumber: session.dialedNumber,
      metadata: sessionMeta ?? null,
    },
    campaign: {
      id: session.campaign.id,
      name: session.campaign.name,
      metadata: campaignMeta ?? null,
    },
    lead: {
      id: session.lead.id,
      phoneNumber: session.lead.phoneNumber,
      normalizedNumber: session.lead.normalizedNumber,
      metadata:
        session.lead.metadata &&
        typeof session.lead.metadata === "object" &&
        !Array.isArray(session.lead.metadata)
          ? session.lead.metadata
          : null,
    },
    route: session.route,
    flow: flow
      ? {
          id: flowSnapshot?.id ?? session.campaign.callFlowId,
          version: flowSnapshot?.version ?? null,
          summary: flowSnapshot?.summary ?? null,
          definition: flow,
        }
      : null,
    rate:
      sessionMeta?.rate ??
      campaignMeta?.rate ??
      null,
  });
}
