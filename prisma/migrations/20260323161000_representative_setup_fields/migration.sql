ALTER TABLE "Representative"
ADD COLUMN "languages" JSONB NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN "freeScope" JSONB NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN "paywalledIntents" JSONB NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN "handoffWindowHours" INTEGER NOT NULL DEFAULT 24,
ADD COLUMN "handoffPrompt" TEXT NOT NULL DEFAULT '';
