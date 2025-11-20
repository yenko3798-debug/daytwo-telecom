-- Add voicemail detection and webhook infrastructure
CREATE TYPE "VoicemailStatus" AS ENUM ('unknown','human','machine','retrying','skipped');

CREATE TYPE "WebhookProvider" AS ENUM ('discord','telegram');

ALTER TABLE "Campaign"
  ADD COLUMN "answeringMachineDetection" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "voicemailRetryLimit" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "CampaignLead"
  ADD COLUMN "voicemailStatus" "VoicemailStatus" NOT NULL DEFAULT 'unknown',
  ADD COLUMN "voicemailRetries" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "CallSession"
  ADD COLUMN "voicemailStatus" "VoicemailStatus" NOT NULL DEFAULT 'unknown';

CREATE TABLE "NotificationWebhook" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" "WebhookProvider" NOT NULL,
  "name" TEXT NOT NULL,
  "config" JSONB NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "lastFiredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationWebhook_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NotificationWebhook_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "NotificationWebhook_userId_active_idx" ON "NotificationWebhook"("userId", "active");
