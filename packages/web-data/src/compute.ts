import { Prisma } from "@prisma/client";
import type { ResolveApprovalResponse } from "@delegate/compute-protocol";

import { prisma } from "./prisma";

const computeSessionInclude = Prisma.validator<Prisma.ComputeSessionDefaultArgs>()({
  include: {
    toolExecutions: {
      orderBy: [{ createdAt: "desc" }],
      take: 5,
    },
  },
});

type ComputeSessionRecord = Prisma.ComputeSessionGetPayload<{
  include: typeof computeSessionInclude.include;
}>;

type RepresentativeIdentity = {
  id: string;
  slug: string;
  displayName: string;
  computeEnabled: boolean;
  computeDefaultPolicyMode: string;
  computeBaseImage: string;
  computeMaxSessionMinutes: number;
  computeAutoApproveBudgetCents: number;
  computeArtifactRetentionDays: number;
  computeNetworkMode: string;
  computeFilesystemMode: string;
};

export type RepresentativeComputeSnapshot = {
  representative: {
    slug: string;
    displayName: string;
    computeEnabled: boolean;
    defaultPolicyMode: "allow" | "ask" | "deny";
    baseImage: string;
    maxSessionMinutes: number;
    autoApproveBudgetCents: number;
    artifactRetentionDays: number;
    networkMode: "no_network" | "allowlist" | "full";
    filesystemMode: "workspace_only" | "read_only_workspace" | "ephemeral_full";
  };
  sessions: Array<{
    id: string;
    status: string;
    requestedBy: string;
    baseImage: string;
    createdAt: string;
    startedAt?: string;
    lastHeartbeatAt?: string;
    expiresAt?: string;
    endedAt?: string;
    failureReason?: string;
    executionCount: number;
    latestExecution?: {
      id: string;
      capability: string;
      status: string;
      requestedCommand?: string;
      createdAt: string;
    };
  }>;
};

export type RepresentativeComputeApprovalSnapshot = {
  representative: {
    slug: string;
    displayName: string;
  };
  approvals: Array<{
    id: string;
    status: string;
    reason: string;
    requestedActionSummary: string;
    riskSummary: string;
    requestedAt: string;
    resolvedAt?: string;
    resolvedBy?: string;
    toolExecutionId?: string;
    sessionId?: string;
  }>;
};

export type RepresentativeComputeArtifactSnapshot = {
  representative: {
    slug: string;
    displayName: string;
  };
  artifacts: Array<{
    id: string;
    kind: string;
    bucket: string;
    objectKey: string;
    mimeType: string;
    sizeBytes: number;
    summary?: string;
    createdAt: string;
    sessionId?: string;
    toolExecutionId?: string;
  }>;
};

export type ResolveRepresentativeComputeApprovalInput = {
  representativeSlug: string;
  approvalId: string;
  resolution: "approved" | "rejected";
  resolvedBy?: string;
};

export async function getRepresentativeComputeSnapshot(
  representativeSlug: string,
): Promise<RepresentativeComputeSnapshot | null> {
  const representative = await getRepresentativeIdentity(representativeSlug);

  if (!representative) {
    return null;
  }

  const sessions = await prisma.computeSession.findMany({
    where: { representativeId: representative.id },
    ...computeSessionInclude,
    orderBy: [{ createdAt: "desc" }],
    take: 20,
  });

  return {
    representative: serializeRepresentativeIdentity(representative),
    sessions: sessions.map((session) => serializeComputeSession(session)),
  };
}

export async function getRepresentativeComputeApprovals(
  representativeSlug: string,
): Promise<RepresentativeComputeApprovalSnapshot | null> {
  const representative = await getRepresentativeIdentity(representativeSlug);

  if (!representative) {
    return null;
  }

  const approvals = await prisma.approvalRequest.findMany({
    where: { representativeId: representative.id },
    orderBy: [{ requestedAt: "desc" }],
    take: 20,
  });

  return {
    representative: {
      slug: representative.slug,
      displayName: representative.displayName,
    },
    approvals: approvals.map((approval) => ({
      id: approval.id,
      status: approval.status.toLowerCase(),
      reason: approval.reason,
      requestedActionSummary: approval.requestedActionSummary,
      riskSummary: approval.riskSummary,
      requestedAt: approval.requestedAt.toISOString(),
      ...(approval.resolvedAt ? { resolvedAt: approval.resolvedAt.toISOString() } : {}),
      ...(approval.resolvedBy ? { resolvedBy: approval.resolvedBy } : {}),
      ...(approval.toolExecutionId ? { toolExecutionId: approval.toolExecutionId } : {}),
      ...(approval.sessionId ? { sessionId: approval.sessionId } : {}),
    })),
  };
}

export async function getRepresentativeComputeArtifacts(
  representativeSlug: string,
): Promise<RepresentativeComputeArtifactSnapshot | null> {
  const representative = await getRepresentativeIdentity(representativeSlug);

  if (!representative) {
    return null;
  }

  const artifacts = await prisma.artifact.findMany({
    where: { representativeId: representative.id },
    orderBy: [{ createdAt: "desc" }],
    take: 50,
  });

  return {
    representative: {
      slug: representative.slug,
      displayName: representative.displayName,
    },
    artifacts: artifacts.map((artifact) => ({
      id: artifact.id,
      kind: artifact.kind.toLowerCase(),
      bucket: artifact.bucket,
      objectKey: artifact.objectKey,
      mimeType: artifact.mimeType,
      sizeBytes: artifact.sizeBytes,
      ...(artifact.summary ? { summary: artifact.summary } : {}),
      createdAt: artifact.createdAt.toISOString(),
      ...(artifact.sessionId ? { sessionId: artifact.sessionId } : {}),
      ...(artifact.toolExecutionId ? { toolExecutionId: artifact.toolExecutionId } : {}),
    })),
  };
}

export async function resolveRepresentativeComputeApproval(
  input: ResolveRepresentativeComputeApprovalInput,
): Promise<ResolveApprovalResponse> {
  const representative = await getRepresentativeIdentity(input.representativeSlug);

  if (!representative) {
    throw new Error(`Representative "${input.representativeSlug}" not found.`);
  }

  const approval = await prisma.approvalRequest.findFirst({
    where: {
      id: input.approvalId,
      representativeId: representative.id,
    },
    select: {
      id: true,
    },
  });

  if (!approval) {
    throw new Error("Approval request not found for this representative.");
  }

  const brokerResponse = await callComputeBroker(
    `/internal/compute/approvals/${input.approvalId}/resolve`,
    {
      method: "POST",
      body: JSON.stringify({
        resolution: input.resolution,
        ...(input.resolvedBy ? { resolvedBy: input.resolvedBy } : {}),
      }),
    },
  );

  return brokerResponse as ResolveApprovalResponse;
}

function serializeComputeSession(session: ComputeSessionRecord) {
  const latestExecution = session.toolExecutions[0];

  return {
    id: session.id,
    status: session.status.toLowerCase(),
    requestedBy: session.requestedBy.toLowerCase(),
    baseImage: session.baseImage,
    createdAt: session.createdAt.toISOString(),
    ...(session.startedAt ? { startedAt: session.startedAt.toISOString() } : {}),
    ...(session.lastHeartbeatAt
      ? { lastHeartbeatAt: session.lastHeartbeatAt.toISOString() }
      : {}),
    ...(session.expiresAt ? { expiresAt: session.expiresAt.toISOString() } : {}),
    ...(session.endedAt ? { endedAt: session.endedAt.toISOString() } : {}),
    ...(session.failureReason ? { failureReason: session.failureReason } : {}),
    executionCount: session.toolExecutions.length,
    ...(latestExecution
      ? {
          latestExecution: {
            id: latestExecution.id,
            capability: latestExecution.capability.toLowerCase(),
            status: latestExecution.status.toLowerCase(),
            ...(latestExecution.requestedCommand
              ? { requestedCommand: latestExecution.requestedCommand }
              : {}),
            createdAt: latestExecution.createdAt.toISOString(),
          },
        }
      : {}),
  };
}

async function getRepresentativeIdentity(
  representativeSlug: string,
): Promise<RepresentativeIdentity | null> {
  return prisma.representative.findUnique({
    where: { slug: representativeSlug },
    select: {
      id: true,
      slug: true,
      displayName: true,
      computeEnabled: true,
      computeDefaultPolicyMode: true,
      computeBaseImage: true,
      computeMaxSessionMinutes: true,
      computeAutoApproveBudgetCents: true,
      computeArtifactRetentionDays: true,
      computeNetworkMode: true,
      computeFilesystemMode: true,
    },
  });
}

function serializeRepresentativeIdentity(representative: RepresentativeIdentity) {
  return {
    slug: representative.slug,
    displayName: representative.displayName,
    computeEnabled: representative.computeEnabled,
    defaultPolicyMode: representative.computeDefaultPolicyMode.toLowerCase() as
      | "allow"
      | "ask"
      | "deny",
    baseImage: representative.computeBaseImage,
    maxSessionMinutes: representative.computeMaxSessionMinutes,
    autoApproveBudgetCents: representative.computeAutoApproveBudgetCents,
    artifactRetentionDays: representative.computeArtifactRetentionDays,
    networkMode: representative.computeNetworkMode.toLowerCase() as
      | "no_network"
      | "allowlist"
      | "full",
    filesystemMode: representative.computeFilesystemMode.toLowerCase() as
      | "workspace_only"
      | "read_only_workspace"
      | "ephemeral_full",
  };
}

async function callComputeBroker(pathname: string, init: RequestInit): Promise<unknown> {
  const baseUrl = (process.env.COMPUTE_BROKER_URL?.trim() || "http://localhost:4010").replace(
    /\/$/,
    "",
  );
  const internalToken = process.env.COMPUTE_BROKER_INTERNAL_TOKEN?.trim();

  if (!internalToken) {
    throw new Error("COMPUTE_BROKER_INTERNAL_TOKEN is not configured.");
  }

  const response = await fetch(`${baseUrl}${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${internalToken}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || "Compute broker request failed.");
  }

  return payload;
}
