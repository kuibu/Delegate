import { Prisma } from "@prisma/client";
import type { ArtifactDetailResponse, ResolveApprovalResponse } from "@delegate/compute-protocol";

import { readArtifactObject } from "./artifact-store";
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
  owner: {
    wallet: {
      balanceCredits: number;
      sponsorPoolCredit: number;
      starsBalance: number;
    } | null;
  };
  capabilityProfiles: Array<{
    id: string;
    name: string;
    isManaged: boolean;
    managedSource: string | null;
    precedence: number;
    rules: Array<{
      id: string;
      capability: string;
      decision: string;
      channelCondition: string | null;
      requiredPlanTier: string | null;
      priority: number;
    }>;
  }>;
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
    wallet: {
      balanceCredits: number;
      sponsorPoolCredit: number;
      starsBalance: number;
    };
    managedProfiles: Array<{
      id: string;
      name: string;
      managedSource?: string;
      precedence: number;
      ruleCount: number;
      highlights: string[];
    }>;
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
  ledger: Array<{
    id: string;
    kind: string;
    creditDelta: number;
    costCents: number;
    quantity: number;
    unit: string;
    createdAt: string;
    notes?: string;
    sessionId?: string;
    toolExecutionId?: string;
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
    retentionUntil?: string;
    sessionId?: string;
    toolExecutionId?: string;
  }>;
};

export type RepresentativeComputeArtifactDetail = ArtifactDetailResponse & {
  representative: {
    slug: string;
    displayName: string;
  };
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

  const [sessions, ledgerEntries] = await Promise.all([
    prisma.computeSession.findMany({
      where: { representativeId: representative.id },
      ...computeSessionInclude,
      orderBy: [{ createdAt: "desc" }],
      take: 20,
    }),
    prisma.ledgerEntry.findMany({
      where: { representativeId: representative.id },
      orderBy: [{ createdAt: "desc" }],
      take: 15,
    }),
  ]);

  return {
    representative: serializeRepresentativeIdentity(representative),
    sessions: sessions.map((session) => serializeComputeSession(session)),
    ledger: ledgerEntries.map((entry) => ({
      id: entry.id,
      kind: entry.kind.toLowerCase(),
      creditDelta: entry.creditDelta,
      costCents: entry.costCents,
      quantity: entry.quantity,
      unit: entry.unit,
      createdAt: entry.createdAt.toISOString(),
      ...(entry.notes ? { notes: entry.notes } : {}),
      ...(entry.sessionId ? { sessionId: entry.sessionId } : {}),
      ...(entry.toolExecutionId ? { toolExecutionId: entry.toolExecutionId } : {}),
    })),
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
      ...(artifact.retentionUntil ? { retentionUntil: artifact.retentionUntil.toISOString() } : {}),
      ...(artifact.sessionId ? { sessionId: artifact.sessionId } : {}),
      ...(artifact.toolExecutionId ? { toolExecutionId: artifact.toolExecutionId } : {}),
    })),
  };
}

export async function getRepresentativeComputeArtifactDetail(
  representativeSlug: string,
  artifactId: string,
): Promise<RepresentativeComputeArtifactDetail | null> {
  const artifact = await getRepresentativeArtifactRecord(representativeSlug, artifactId);

  if (!artifact) {
    return null;
  }

  const { buffer } = await readArtifactObject(artifact.objectKey);
  const isTextArtifact =
    artifact.mimeType.startsWith("text/") ||
    artifact.mimeType.includes("json") ||
    artifact.kind === "STDOUT" ||
    artifact.kind === "STDERR" ||
    artifact.kind === "TRACE";
  const text = isTextArtifact ? buffer.toString("utf8") : null;
  const maxChars = 20000;
  const contentText = text ? text.slice(0, maxChars) : null;

  return {
    representative: {
      slug: artifact.representative.slug,
      displayName: artifact.representative.displayName,
    },
    artifact: {
      id: artifact.id,
      representativeId: artifact.representativeId,
      contactId: artifact.contactId,
      conversationId: artifact.conversationId,
      sessionId: artifact.sessionId,
      toolExecutionId: artifact.toolExecutionId,
      kind: artifact.kind.toLowerCase() as
        | "stdout"
        | "stderr"
        | "file"
        | "archive"
        | "screenshot"
        | "json"
        | "trace",
      bucket: artifact.bucket,
      objectKey: artifact.objectKey,
      mimeType: artifact.mimeType,
      sizeBytes: artifact.sizeBytes,
      sha256: artifact.sha256,
      retentionUntil: artifact.retentionUntil?.toISOString() ?? null,
      summary: artifact.summary,
      createdAt: artifact.createdAt.toISOString(),
    },
    contentText,
    truncated: Boolean(text && text.length > maxChars),
  };
}

export async function getRepresentativeComputeArtifactDownload(
  representativeSlug: string,
  artifactId: string,
): Promise<{
  fileName: string;
  mimeType: string;
  buffer: Buffer;
} | null> {
  const artifact = await getRepresentativeArtifactRecord(representativeSlug, artifactId);

  if (!artifact) {
    return null;
  }

  const { buffer } = await readArtifactObject(artifact.objectKey);

  return {
    fileName: buildArtifactFileName(artifact),
    mimeType: artifact.mimeType,
    buffer,
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
      owner: {
        select: {
          wallet: {
            select: {
              balanceCredits: true,
              sponsorPoolCredit: true,
              starsBalance: true,
            },
          },
        },
      },
      capabilityProfiles: {
        where: {
          isManaged: true,
        },
        orderBy: [{ precedence: "desc" }, { createdAt: "asc" }],
        select: {
          id: true,
          name: true,
          isManaged: true,
          managedSource: true,
          precedence: true,
          rules: {
            orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
            select: {
              id: true,
              capability: true,
              decision: true,
              channelCondition: true,
              requiredPlanTier: true,
              priority: true,
            },
          },
        },
      },
    },
  });
}

async function getRepresentativeArtifactRecord(representativeSlug: string, artifactId: string) {
  return prisma.artifact.findFirst({
    where: {
      id: artifactId,
      representative: {
        slug: representativeSlug,
      },
    },
    include: {
      representative: {
        select: {
          slug: true,
          displayName: true,
        },
      },
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
    wallet: {
      balanceCredits: representative.owner.wallet?.balanceCredits ?? 0,
      sponsorPoolCredit: representative.owner.wallet?.sponsorPoolCredit ?? 0,
      starsBalance: representative.owner.wallet?.starsBalance ?? 0,
    },
    managedProfiles: representative.capabilityProfiles.map((profile) => ({
      id: profile.id,
      name: profile.name,
      ...(profile.managedSource ? { managedSource: profile.managedSource } : {}),
      precedence: profile.precedence,
      ruleCount: profile.rules.length,
      highlights: profile.rules.slice(0, 3).map((rule) => {
        const channel = rule.channelCondition ? ` @ ${rule.channelCondition.toLowerCase()}` : "";
        const plan = rule.requiredPlanTier ? ` / ${rule.requiredPlanTier.toLowerCase()}` : "";
        return `${rule.capability.toLowerCase()} -> ${rule.decision.toLowerCase()}${channel}${plan}`;
      }),
    })),
  };
}

function buildArtifactFileName(artifact: {
  id: string;
  kind: string;
  objectKey: string;
  mimeType: string;
}) {
  const extension =
    artifact.mimeType.includes("json")
      ? "json"
      : artifact.mimeType.includes("text/")
        ? "txt"
        : artifact.objectKey.split(".").pop() || "bin";
  return `${artifact.kind.toLowerCase()}-${artifact.id}.${extension}`;
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
