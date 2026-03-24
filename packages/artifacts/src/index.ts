import { z } from "zod";
import type { ArtifactKind } from "@delegate/compute-protocol";

export const artifactStoreConfigSchema = z.object({
  endpoint: z.string().url(),
  bucket: z.string().min(1),
  accessKeyId: z.string().min(1),
  secretAccessKey: z.string().min(1),
  region: z.string().min(1).default("us-east-1"),
  forcePathStyle: z.boolean().default(true),
});

export type ArtifactStoreConfig = z.infer<typeof artifactStoreConfigSchema>;

export function buildArtifactObjectKey(input: {
  representativeSlug: string;
  contactId?: string | null | undefined;
  conversationId?: string | null | undefined;
  sessionId: string;
  executionId?: string | null | undefined;
  artifactKind: ArtifactKind;
  artifactId: string;
}): string {
  const contactId = input.contactId ?? "anonymous";
  const conversationId = input.conversationId ?? "no-conversation";
  const executionPart = input.executionId ? `/executions/${input.executionId}` : "";

  return [
    "delegate",
    "reps",
    input.representativeSlug,
    "contacts",
    contactId,
    "conversations",
    conversationId,
    "sessions",
    input.sessionId + executionPart,
    `${input.artifactKind}-${input.artifactId}`,
  ]
    .join("/")
    .replace(/\/+/g, "/");
}

export function resolveArtifactRetentionUntil(createdAt: Date, retentionDays: number): Date {
  return new Date(createdAt.getTime() + retentionDays * 24 * 60 * 60 * 1000);
}
