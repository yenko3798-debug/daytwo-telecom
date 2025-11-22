-- CreateEnum
CREATE TYPE "WebhookChannelType" AS ENUM ('discord', 'telegram');

-- CreateEnum
CREATE TYPE "VoicemailStatus" AS ENUM ('unknown', 'human', 'machine', 'retrying');

-- AlterTable Campaign
ALTER TABLE "Campaign"
  ADD COLUMN "amdEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "voicemailRetryLimit" INTEGER NOT NULL DEFAULT 0;

-- AlterTable CampaignLead
ALTER TABLE "CampaignLead"
  ADD COLUMN "rawLineHash" CHAR(64),
  ADD COLUMN "voicemailCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastVoicemailAt" TIMESTAMP(3);

-- AlterTable CallSession
ALTER TABLE "CallSession"
  ADD COLUMN "voicemailStatus" "VoicemailStatus" NOT NULL DEFAULT 'unknown',
  ADD COLUMN "voicemailScore" INTEGER;

-- CreateTable WebhookEndpoint
CREATE TABLE "WebhookEndpoint" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "WebhookChannelType" NOT NULL,
  "label" TEXT,
  "discordWebhook" TEXT,
  "telegramBotToken" TEXT,
  "telegramChatId" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebhookEndpoint_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WebhookEndpoint_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Indexes
CREATE INDEX "CampaignLead_normalizedNumber_idx" ON "CampaignLead"("normalizedNumber");
CREATE INDEX "CampaignLead_rawLineHash_idx" ON "CampaignLead"("rawLineHash");
CREATE INDEX "CallSession_voicemailStatus_idx" ON "CallSession"("voicemailStatus");
CREATE INDEX "WebhookEndpoint_userId_enabled_idx" ON "WebhookEndpoint"("userId", "enabled");
