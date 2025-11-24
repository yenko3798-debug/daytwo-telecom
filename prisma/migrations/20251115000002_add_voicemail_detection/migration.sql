-- Add voicemail detection columns to CallSession
ALTER TABLE "CallSession"
  ADD COLUMN "voicemailDetected" BOOLEAN,
  ADD COLUMN "voicemailConfidence" DOUBLE PRECISION,
  ADD COLUMN "voicemailReason" TEXT,
  ADD COLUMN "voicemailTranscript" TEXT,
  ADD COLUMN "voicemailRaw" JSONB;
