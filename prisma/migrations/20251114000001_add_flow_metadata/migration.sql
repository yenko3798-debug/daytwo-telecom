-- Add metadata column to CallFlow for storing summaries and builder context
ALTER TABLE "CallFlow"
ADD COLUMN "metadata" JSONB;
