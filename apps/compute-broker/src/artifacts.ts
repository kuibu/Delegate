import { randomBytes, createHash } from "node:crypto";

import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { buildArtifactObjectKey, resolveArtifactRetentionUntil } from "@delegate/artifacts";

import { computeBrokerConfig } from "./config";
import { prisma } from "./prisma";

const artifactClient = new S3Client({
  region: computeBrokerConfig.artifactStore.region,
  endpoint: computeBrokerConfig.artifactStore.endpoint,
  forcePathStyle: computeBrokerConfig.artifactStore.forcePathStyle,
  credentials: {
    accessKeyId: computeBrokerConfig.artifactStore.accessKeyId,
    secretAccessKey: computeBrokerConfig.artifactStore.secretAccessKey,
  },
});

let bucketReadyPromise: Promise<void> | null = null;

export async function persistExecutionArtifacts(params: {
  representativeId: string;
  representativeSlug: string;
  contactId?: string | null | undefined;
  conversationId?: string | null | undefined;
  sessionId: string;
  executionId: string;
  retentionDays: number;
  stdout: string;
  stderr: string;
}) {
  const artifacts = [];

  if (params.stdout.length > 0) {
    artifacts.push(
      await persistTextArtifact({
        representativeId: params.representativeId,
        representativeSlug: params.representativeSlug,
        contactId: params.contactId,
        conversationId: params.conversationId,
        sessionId: params.sessionId,
        executionId: params.executionId,
        kind: "STDOUT",
        content: params.stdout,
        retentionDays: params.retentionDays,
      }),
    );
  }

  if (params.stderr.length > 0) {
    artifacts.push(
      await persistTextArtifact({
        representativeId: params.representativeId,
        representativeSlug: params.representativeSlug,
        contactId: params.contactId,
        conversationId: params.conversationId,
        sessionId: params.sessionId,
        executionId: params.executionId,
        kind: "STDERR",
        content: params.stderr,
        retentionDays: params.retentionDays,
      }),
    );
  }

  return artifacts;
}

async function persistTextArtifact(params: {
  representativeId: string;
  representativeSlug: string;
  contactId?: string | null | undefined;
  conversationId?: string | null | undefined;
  sessionId: string;
  executionId: string;
  kind: "STDOUT" | "STDERR";
  content: string;
  retentionDays: number;
}) {
  const createdAt = new Date();
  const artifactId = `artifact_${randomBytes(8).toString("hex")}`;
  const body = Buffer.from(params.content, "utf8");
  const objectKey = buildArtifactObjectKey({
    representativeSlug: params.representativeSlug,
    contactId: params.contactId,
    conversationId: params.conversationId,
    sessionId: params.sessionId,
    executionId: params.executionId,
    artifactKind: params.kind.toLowerCase() as "stdout" | "stderr",
    artifactId,
  });

  await ensureArtifactBucket();

  await artifactClient.send(
    new PutObjectCommand({
      Bucket: computeBrokerConfig.artifactStore.bucket,
      Key: objectKey,
      Body: body,
      ContentType: "text/plain; charset=utf-8",
    }),
  );

  const artifact = await prisma.artifact.create({
    data: {
      id: artifactId,
      representativeId: params.representativeId,
      contactId: params.contactId ?? null,
      conversationId: params.conversationId ?? null,
      sessionId: params.sessionId,
      toolExecutionId: params.executionId,
      kind: params.kind,
      bucket: computeBrokerConfig.artifactStore.bucket,
      objectKey,
      mimeType: "text/plain; charset=utf-8",
      sizeBytes: body.byteLength,
      sha256: sha256(body),
      retentionUntil: resolveArtifactRetentionUntil(createdAt, params.retentionDays),
      summary: summarizeArtifact(params.content),
      createdAt,
    },
  });

  await prisma.eventAudit.create({
    data: {
      representativeId: params.representativeId,
      contactId: params.contactId ?? null,
      conversationId: params.conversationId ?? null,
      type: "ARTIFACT_STORED",
      payload: {
        artifactId: artifact.id,
        executionId: params.executionId,
        kind: params.kind.toLowerCase(),
        objectKey,
        sizeBytes: body.byteLength,
      },
    },
  });

  return artifact;
}

function summarizeArtifact(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return "";
  }

  return normalized.slice(0, 240);
}

function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

async function ensureArtifactBucket() {
  if (!bucketReadyPromise) {
    bucketReadyPromise = (async () => {
      try {
        await artifactClient.send(
          new HeadBucketCommand({
            Bucket: computeBrokerConfig.artifactStore.bucket,
          }),
        );
      } catch {
        await artifactClient.send(
          new CreateBucketCommand({
            Bucket: computeBrokerConfig.artifactStore.bucket,
          }),
        );
      }
    })();
  }

  return bucketReadyPromise;
}
