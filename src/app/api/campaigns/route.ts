import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { CampaignStatus } from "@prisma/client";
import { FlowDefinitionSchema, RATE_PER_LEAD_CENTS, summarizeFlow } from "@/lib/flows";

const createSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(240).optional(),
  callFlowId: z.string().cuid(),
  routeId: z.string().cuid(),
  callerId: z.string().min(8).max(32),
  callsPerMinute: z.number().int().min(1).max(600).optional(),
  maxConcurrentCalls: z.number().int().min(1).max(200).optional(),
  ringTimeoutSeconds: z.number().int().min(10).max(120).optional(),
  startAt: z.string().datetime().optional(),
  metadata: z.record(z.any()).optional(),
});

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function ensureAdmin(role: string | undefined) {
  return role === "admin" || role === "superadmin";
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return unauthorized();
  const isAdmin = ensureAdmin(session.role);
  const url = new URL(req.url);
  const scope = url.searchParams.get("scope");
  const includeAll = isAdmin && scope === "all";

  const campaigns = await prisma.campaign.findMany({
    where: includeAll ? {} : { userId: session.sub },
    orderBy: { createdAt: "desc" },
    include: {
      route: {
        select: {
          id: true,
          name: true,
          provider: true,
        },
      },
      callFlow: {
        select: { id: true, name: true },
      },
    },
  });

  return NextResponse.json({
    campaigns: campaigns.map((campaign) => ({
      ...campaign,
      status: campaign.status.toLowerCase(),
    })),
  });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return unauthorized();
  const isAdmin = ensureAdmin(session.role);

    try {
      const body = createSchema.parse(await req.json());

      const [flow, route] = await Promise.all([
        prisma.callFlow.findUnique({
          where: { id: body.callFlowId },
        }),
        prisma.sipRoute.findUnique({
          where: { id: body.routeId },
        }),
      ]);

      if (!flow) {
        return NextResponse.json({ error: "Flow not found" }, { status: 404 });
      }
      if (!route) {
        return NextResponse.json({ error: "Route not found" }, { status: 404 });
      }

      if (!isAdmin) {
        if (!flow.isSystem && flow.userId !== session.sub) {
          return NextResponse.json({ error: "Flow unavailable" }, { status: 403 });
        }
        if (!route.isPublic && route.createdById !== session.sub) {
          return NextResponse.json({ error: "Route unavailable" }, { status: 403 });
        }
      }
      if (route.status !== "ACTIVE") {
        return NextResponse.json({ error: "Route is not active" }, { status: 403 });
      }

      const flowDefinition = FlowDefinitionSchema.parse(flow.definition);
      const flowSummary =
        (flow.metadata &&
          typeof flow.metadata === "object" &&
          !Array.isArray(flow.metadata) &&
          (flow.metadata as Record<string, any>).summary) ||
        summarizeFlow(flowDefinition);
      const flowVersion =
        (flow.metadata &&
          typeof flow.metadata === "object" &&
          !Array.isArray(flow.metadata) &&
          (flow.metadata as Record<string, any>).summary?.version) ||
        flow.updatedAt.toISOString();

      const baseMetadata =
        body.metadata && typeof body.metadata === "object"
          ? (body.metadata as Record<string, any>)
          : {};
      const metadata = {
        ...baseMetadata,
        flow: {
          id: flow.id,
          name: flow.name,
          version: flowVersion,
          summary: flowSummary,
          definition: flowDefinition,
        },
        rate: {
          perLeadCents: RATE_PER_LEAD_CENTS,
        },
      };

    const status = body.startAt
      ? CampaignStatus.SCHEDULED
      : CampaignStatus.DRAFT;

    const campaign = await prisma.campaign.create({
      data: {
        name: body.name,
        description: body.description ?? null,
        callFlowId: body.callFlowId,
        routeId: body.routeId,
        userId: session.sub,
        status,
          callerId: body.callerId,
          callsPerMinute: body.callsPerMinute ?? 60,
          maxConcurrentCalls: body.maxConcurrentCalls ?? 10,
          ringTimeoutSeconds: body.ringTimeoutSeconds ?? 45,
          startAt: body.startAt ? new Date(body.startAt) : null,
          metadata,
      },
      include: {
        route: { select: { id: true, name: true, provider: true } },
        callFlow: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(
      {
        campaign: {
          ...campaign,
          status: campaign.status.toLowerCase(),
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error?.issues?.[0]?.message) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to create campaign" }, { status: 400 });
  }
}
