-- Enum definitions
CREATE TYPE "UserRole" AS ENUM ('user', 'admin', 'superadmin');
CREATE TYPE "RouteStatus" AS ENUM ('active', 'inactive', 'maintenance');
CREATE TYPE "CampaignStatus" AS ENUM ('draft', 'scheduled', 'running', 'paused', 'completed', 'stopped', 'failed');
CREATE TYPE "LeadStatus" AS ENUM ('pending', 'queued', 'dialing', 'connected', 'completed', 'failed', 'skipped', 'paused');
CREATE TYPE "CallStatus" AS ENUM ('created', 'placing', 'ringing', 'answered', 'completed', 'failed', 'hungup', 'cancelled');
CREATE TYPE "AdjustmentType" AS ENUM ('credit', 'debit');
CREATE TYPE "AdjustmentSource" AS ENUM ('admin_adjustment', 'top_up', 'campaign_charge', 'refund');

-- CreateTable: User
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "balanceCents" INTEGER NOT NULL DEFAULT 0,
    "role" "UserRole" NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateTable: SipRoute
CREATE TABLE "SipRoute" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "authUsername" TEXT,
    "authPassword" TEXT,
    "outboundUri" TEXT,
    "trunkPrefix" TEXT,
    "callerIdFormat" TEXT,
    "maxChannels" INTEGER NOT NULL DEFAULT 50,
    "concurrencyLimit" INTEGER,
    "costPerMinuteCents" INTEGER NOT NULL DEFAULT 0,
    "status" "RouteStatus" NOT NULL DEFAULT 'active',
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    CONSTRAINT "SipRoute_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SipRoute_status_idx" ON "SipRoute"("status");

-- CreateTable: CallFlow (metadata added later)
CREATE TABLE "CallFlow" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "definition" JSONB NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CallFlow_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CallFlow_userId_idx" ON "CallFlow"("userId");

-- CreateTable: Campaign
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "callFlowId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'draft',
    "callerId" TEXT NOT NULL,
    "callsPerMinute" INTEGER NOT NULL DEFAULT 60,
    "maxConcurrentCalls" INTEGER NOT NULL DEFAULT 10,
    "ringTimeoutSeconds" INTEGER NOT NULL DEFAULT 45,
    "startAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "stopReason" TEXT,
    "totalLeads" INTEGER NOT NULL DEFAULT 0,
    "dialedCount" INTEGER NOT NULL DEFAULT 0,
    "connectedCount" INTEGER NOT NULL DEFAULT 0,
    "dtmfCount" INTEGER NOT NULL DEFAULT 0,
    "costCents" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Campaign_userId_idx" ON "Campaign"("userId");
CREATE INDEX "Campaign_status_idx" ON "Campaign"("status");

-- CreateTable: CampaignLead
CREATE TABLE "CampaignLead" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "normalizedNumber" TEXT NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'pending',
    "dtmf" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastDialedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CampaignLead_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CampaignLead_campaignId_idx" ON "CampaignLead"("campaignId");
CREATE INDEX "CampaignLead_campaignId_status_idx" ON "CampaignLead"("campaignId","status");
CREATE UNIQUE INDEX "CampaignLead_campaign_phone_unique" ON "CampaignLead"("campaignId","phoneNumber");

-- CreateTable: CallSession
CREATE TABLE "CallSession" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "ariChannelId" TEXT,
    "externalId" TEXT,
    "status" "CallStatus" NOT NULL DEFAULT 'created',
    "callerId" TEXT NOT NULL,
    "dialedNumber" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "answeredAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "costCents" INTEGER NOT NULL DEFAULT 0,
    "dtmf" TEXT,
    "recordingUrl" TEXT,
    "metadata" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CallSession_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CallSession_campaignId_idx" ON "CallSession"("campaignId");
CREATE INDEX "CallSession_leadId_idx" ON "CallSession"("leadId");
CREATE INDEX "CallSession_routeId_idx" ON "CallSession"("routeId");
CREATE INDEX "CallSession_status_idx" ON "CallSession"("status");
CREATE INDEX "CallSession_ariChannelId_idx" ON "CallSession"("ariChannelId");

-- CreateTable: BalanceAdjustment
CREATE TABLE "BalanceAdjustment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdById" TEXT,
    "amountCents" INTEGER NOT NULL,
    "type" "AdjustmentType" NOT NULL,
    "source" "AdjustmentSource" NOT NULL,
    "reason" TEXT,
    "referenceId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BalanceAdjustment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BalanceAdjustment_userId_idx" ON "BalanceAdjustment"("userId");
CREATE INDEX "BalanceAdjustment_source_idx" ON "BalanceAdjustment"("source");

-- CreateTable: SystemSetting
CREATE TABLE "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- Foreign keys
ALTER TABLE "SipRoute"
  ADD CONSTRAINT "SipRoute_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CallFlow"
  ADD CONSTRAINT "CallFlow_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Campaign"
  ADD CONSTRAINT "Campaign_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Campaign"
  ADD CONSTRAINT "Campaign_callFlowId_fkey"
  FOREIGN KEY ("callFlowId") REFERENCES "CallFlow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Campaign"
  ADD CONSTRAINT "Campaign_routeId_fkey"
  FOREIGN KEY ("routeId") REFERENCES "SipRoute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CampaignLead"
  ADD CONSTRAINT "CampaignLead_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CallSession"
  ADD CONSTRAINT "CallSession_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CallSession"
  ADD CONSTRAINT "CallSession_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "CampaignLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CallSession"
  ADD CONSTRAINT "CallSession_routeId_fkey"
  FOREIGN KEY ("routeId") REFERENCES "SipRoute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BalanceAdjustment"
  ADD CONSTRAINT "BalanceAdjustment_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BalanceAdjustment"
  ADD CONSTRAINT "BalanceAdjustment_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SystemSetting"
  ADD CONSTRAINT "SystemSetting_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
