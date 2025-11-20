import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { normalizePhoneNumber } from "@/lib/phone";
import { LeadStatus } from "@prisma/client";

const createSchema = z.object({
  leads: z
    .array(
      z.object({
        phone: z.string().min(6).max(32),
        metadata: z.record(z.any()).optional(),
        raw: z.string().max(2048).optional(),
      })
    )
    .min(1),
  country: z.string().length(2).optional(),
});

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function ensureAdmin(role: string | undefined) {
  return role === "admin" || role === "superadmin";
}

function hashRawLine(raw?: string | null) {
  if (!raw) return null;
  const normalized = raw.trim().replace(/\s+/g, " ").toLowerCase();
  if (!normalized) return null;
  return createHash("sha256").update(normalized).digest("hex");
}

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const session = await getSession();
  if (!session) return unauthorized();
  const isAdmin = ensureAdmin(session.role);

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isAdmin && campaign.userId !== session.sub) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") ?? "50", 10), 1), 200);
  const cursor = url.searchParams.get("cursor");
  const status = url.searchParams.get("status");

  const where: any = { campaignId: id };
  if (status && status in LeadStatus) {
    where.status = status.toUpperCase();
  }

  const leads = await prisma.campaignLead.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor
      ? {
          cursor: { id: cursor },
          skip: 1,
        }
      : {}),
  });

  const hasMore = leads.length > limit;
  const items = hasMore ? leads.slice(0, -1) : leads;

  return NextResponse.json({
    leads: items,
    nextCursor: hasMore ? items[items.length - 1]?.id : null,
  });
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const session = await getSession();
  if (!session) return unauthorized();
  const isAdmin = ensureAdmin(session.role);

    try {
      const body = createSchema.parse(await req.json());
      const campaign = await prisma.campaign.findUnique({
        where: { id },
        select: { id: true, userId: true },
      });
    if (!campaign) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!isAdmin && campaign.userId !== session.sub) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

      const prepared = body.leads.map((lead) => {
        const normalized =
          normalizePhoneNumber(lead.phone, (body.country as any) ?? "US") ?? lead.phone;
        const metadataPayload: Record<string, any> = {};
        if (lead.metadata && typeof lead.metadata === "object") {
          Object.assign(metadataPayload, lead.metadata);
        }
        if (lead.raw) {
          metadataPayload.rawLine = lead.raw;
        }
        const metadata =
          Object.keys(metadataPayload).length > 0 ? metadataPayload : null;
        const rawHash = hashRawLine(lead.raw ?? (typeof metadataPayload.rawLine === "string" ? metadataPayload.rawLine : null));
        return {
          campaignId: id,
          phoneNumber: lead.phone,
          normalizedNumber: normalized,
          status: LeadStatus.PENDING,
          metadata,
          rawLineHash: rawHash,
        };
      });

      const normalizedTargets = Array.from(
        new Set(prepared.map((lead) => lead.normalizedNumber).filter((value): value is string => Boolean(value)))
      );
      const hashTargets = Array.from(
        new Set(prepared.map((lead) => lead.rawLineHash).filter((value): value is string => Boolean(value)))
      );

      let suppressedCount = 0;
      let filtered = prepared;

      if (normalizedTargets.length > 0 || hashTargets.length > 0) {
        const suppressMatches =
          (await prisma.campaignLead.findMany({
            where: {
              campaign: { userId: campaign.userId },
              dtmf: { startsWith: "1" },
              OR: [
                normalizedTargets.length > 0
                  ? { normalizedNumber: { in: normalizedTargets } }
                  : undefined,
                hashTargets.length > 0 ? { rawLineHash: { in: hashTargets } } : undefined,
              ].filter(Boolean) as any,
            },
            select: { normalizedNumber: true, rawLineHash: true },
          })) ?? [];

        if (suppressMatches.length > 0) {
          const blockedNumbers = new Set(
            suppressMatches
              .map((entry) => entry.normalizedNumber)
              .filter((value): value is string => Boolean(value))
          );
          const blockedHashes = new Set(
            suppressMatches.map((entry) => entry.rawLineHash).filter((value): value is string => Boolean(value))
          );

          filtered = prepared.filter((lead) => {
            if (lead.normalizedNumber && blockedNumbers.has(lead.normalizedNumber)) {
              suppressedCount += 1;
              return false;
            }
            if (lead.rawLineHash && blockedHashes.has(lead.rawLineHash)) {
              suppressedCount += 1;
              return false;
            }
            return true;
          });
        }
      }

      if (filtered.length === 0) {
        return NextResponse.json({ inserted: 0, skipped: suppressedCount });
      }

      const inserted = await prisma.$transaction(async (tx) => {
        const created = await tx.campaignLead.createMany({
          data: filtered,
          skipDuplicates: true,
        });

        if (created.count > 0) {
          await tx.campaign.update({
            where: { id },
            data: { totalLeads: { increment: created.count } },
          });
        }

        return created.count;
      });

      return NextResponse.json({ inserted, skipped: suppressedCount });
  } catch (error: any) {
    if (error?.issues?.[0]?.message) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to add leads" }, { status: 400 });
  }
}
