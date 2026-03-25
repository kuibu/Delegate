import { posix as pathPosix } from "node:path";

import { Prisma } from "@prisma/client";
import {
  updateArtifactRequestSchema,
  updateArtifactResponseSchema,
  upsertMcpBindingRequestSchema,
  type ArtifactDetailResponse,
  type McpBindingSnapshot,
  type ResolveApprovalResponse,
  type UpdateArtifactResponse,
  type UpsertMcpBindingRequest,
} from "@delegate/compute-protocol";
import { resolveArtifactRetentionUntil } from "@delegate/artifacts";

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
  computeNetworkAllowlist: string[];
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
  mcpBindings: Array<{
    id: string;
    representativeId: string;
    representativeSkillPackLinkId: string | null;
    slug: string;
    displayName: string;
    description: string | null;
    serverUrl: string;
    transportKind: string;
    allowedToolNames: Prisma.JsonValue;
    defaultToolName: string | null;
    enabled: boolean;
    approvalRequired: boolean;
    createdAt: Date;
    updatedAt: Date;
    representativeSkillPackLink: {
      skillPack: {
        displayName: string;
      };
    } | null;
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
    networkAllowlist: string[];
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
    mcpBindings: Array<
      McpBindingSnapshot & {
        sourceSkillPack?: string;
      }
    >;
  };
  sessions: Array<{
    id: string;
    status: string;
    leaseStatus: string;
    requestedBy: string;
    baseImage: string;
    runnerLeaseId?: string;
    containerId?: string;
    createdAt: string;
    leaseAcquiredAt?: string;
    leaseLastUsedAt?: string;
    leaseReleasedAt?: string;
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
    isPinned: boolean;
    pinnedAt?: string;
    pinnedBy?: string;
    downloadCount: number;
    lastDownloadedAt?: string;
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

export type UpsertRepresentativeMcpBindingInput = {
  representativeSlug: string;
  bindingId?: string;
} & UpsertMcpBindingRequest;

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
      isPinned: artifact.isPinned,
      downloadCount: artifact.downloadCount,
      ...(artifact.pinnedAt ? { pinnedAt: artifact.pinnedAt.toISOString() } : {}),
      ...(artifact.pinnedBy ? { pinnedBy: artifact.pinnedBy } : {}),
      ...(artifact.lastDownloadedAt
        ? { lastDownloadedAt: artifact.lastDownloadedAt.toISOString() }
        : {}),
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
      isPinned: artifact.isPinned,
      pinnedAt: artifact.pinnedAt?.toISOString() ?? null,
      pinnedBy: artifact.pinnedBy,
      downloadCount: artifact.downloadCount,
      lastDownloadedAt: artifact.lastDownloadedAt?.toISOString() ?? null,
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
  options?: {
    recordDownload?: boolean;
  },
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

  if (options?.recordDownload !== false) {
    const now = new Date();
    const egressCostCents = Math.max(1, Math.ceil(buffer.byteLength / 65536));
    await prisma.$transaction([
      prisma.artifact.update({
        where: { id: artifact.id },
        data: {
          downloadCount: {
            increment: 1,
          },
          lastDownloadedAt: now,
        },
      }),
      prisma.ledgerEntry.create({
        data: {
          representativeId: artifact.representativeId,
          contactId: artifact.contactId,
          conversationId: artifact.conversationId,
          sessionId: artifact.sessionId,
          toolExecutionId: artifact.toolExecutionId,
          kind: "ARTIFACT_EGRESS",
          quantity: buffer.byteLength,
          unit: "byte",
          costCents: egressCostCents,
          creditDelta: 0,
          notes: "artifact_download_egress",
        },
      }),
    ]);
  }

  return {
    fileName: buildArtifactFileName(artifact),
    mimeType: artifact.mimeType,
    buffer,
  };
}

export async function updateRepresentativeComputeArtifact(
  representativeSlug: string,
  artifactId: string,
  rawInput: unknown,
): Promise<UpdateArtifactResponse | null> {
  const input = updateArtifactRequestSchema.parse(rawInput);
  const artifact = await getRepresentativeArtifactRecord(representativeSlug, artifactId);

  if (!artifact) {
    return null;
  }

  const nextRetentionUntil = input.pinned
    ? null
    : resolveArtifactRetentionUntil(
        artifact.createdAt,
        artifact.representative.computeArtifactRetentionDays,
      );
  const updated = await prisma.artifact.update({
    where: { id: artifact.id },
    data: {
      isPinned: input.pinned,
      pinnedAt: input.pinned ? new Date() : null,
      pinnedBy: input.pinned ? input.pinnedBy ?? "owner-dashboard" : null,
      retentionUntil: nextRetentionUntil,
    },
  });

  return updateArtifactResponseSchema.parse({
    artifact: {
      id: updated.id,
      representativeId: updated.representativeId,
      contactId: updated.contactId,
      conversationId: updated.conversationId,
      sessionId: updated.sessionId,
      toolExecutionId: updated.toolExecutionId,
      kind: updated.kind.toLowerCase(),
      bucket: updated.bucket,
      objectKey: updated.objectKey,
      mimeType: updated.mimeType,
      sizeBytes: updated.sizeBytes,
      sha256: updated.sha256,
      isPinned: updated.isPinned,
      pinnedAt: updated.pinnedAt?.toISOString() ?? null,
      pinnedBy: updated.pinnedBy,
      downloadCount: updated.downloadCount,
      lastDownloadedAt: updated.lastDownloadedAt?.toISOString() ?? null,
      retentionUntil: updated.retentionUntil?.toISOString() ?? null,
      summary: updated.summary,
      createdAt: updated.createdAt.toISOString(),
    },
  });
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

export async function upsertRepresentativeMcpBinding(
  input: UpsertRepresentativeMcpBindingInput,
): Promise<McpBindingSnapshot> {
  const representative = await getRepresentativeIdentity(input.representativeSlug);

  if (!representative) {
    throw new Error(`Representative "${input.representativeSlug}" not found.`);
  }

  const parsed = upsertMcpBindingRequestSchema.parse({
    representativeSkillPackLinkId: input.representativeSkillPackLinkId,
    slug: input.slug,
    displayName: input.displayName,
    description: input.description,
    serverUrl: input.serverUrl,
    transportKind: input.transportKind,
    allowedToolNames: input.allowedToolNames,
    defaultToolName: input.defaultToolName,
    enabled: input.enabled,
    approvalRequired: input.approvalRequired,
  });

  const linkId = parsed.representativeSkillPackLinkId ?? null;
  if (linkId) {
    const linkedSkillPack = await prisma.representativeSkillPack.findFirst({
      where: {
        id: linkId,
        representativeId: representative.id,
      },
      select: {
        id: true,
      },
    });

    if (!linkedSkillPack) {
      throw new Error("Representative skill pack link not found for this binding.");
    }
  }

  if (parsed.defaultToolName && !parsed.allowedToolNames.includes(parsed.defaultToolName)) {
    throw new Error("The default MCP tool must be included in allowedToolNames.");
  }

  const existingBinding =
    input.bindingId
      ? await prisma.representativeMcpBinding.findFirst({
          where: {
            id: input.bindingId,
            representativeId: representative.id,
          },
        })
      : null;

  if (input.bindingId && !existingBinding) {
    throw new Error("MCP binding not found for this representative.");
  }

  const binding = input.bindingId
    ? await prisma.representativeMcpBinding.update({
        where: { id: input.bindingId },
        data: {
          representativeSkillPackLinkId: linkId,
          slug: parsed.slug,
          displayName: parsed.displayName,
          description: parsed.description ?? null,
          serverUrl: parsed.serverUrl,
          transportKind: parsed.transportKind.toUpperCase() as "STREAMABLE_HTTP",
          allowedToolNames: parsed.allowedToolNames,
          defaultToolName: parsed.defaultToolName ?? null,
          enabled: parsed.enabled,
          approvalRequired: parsed.approvalRequired,
        },
      })
    : await prisma.representativeMcpBinding.create({
        data: {
          representativeId: representative.id,
          representativeSkillPackLinkId: linkId,
          slug: parsed.slug,
          displayName: parsed.displayName,
          description: parsed.description ?? null,
          serverUrl: parsed.serverUrl,
          transportKind: parsed.transportKind.toUpperCase() as "STREAMABLE_HTTP",
          allowedToolNames: parsed.allowedToolNames,
          defaultToolName: parsed.defaultToolName ?? null,
          enabled: parsed.enabled,
          approvalRequired: parsed.approvalRequired,
        },
      });

  return serializeMcpBindingRecord({
    ...binding,
    representativeSkillPackLink: null,
  });
}

function serializeComputeSession(session: ComputeSessionRecord) {
  const latestExecution = session.toolExecutions[0];

  return {
    id: session.id,
    status: session.status.toLowerCase(),
    leaseStatus: session.leaseStatus.toLowerCase(),
    requestedBy: session.requestedBy.toLowerCase(),
    baseImage: session.baseImage,
    ...(session.runnerLeaseId ? { runnerLeaseId: session.runnerLeaseId } : {}),
    ...(session.containerId ? { containerId: session.containerId } : {}),
    createdAt: session.createdAt.toISOString(),
    ...(session.leaseAcquiredAt ? { leaseAcquiredAt: session.leaseAcquiredAt.toISOString() } : {}),
    ...(session.leaseLastUsedAt ? { leaseLastUsedAt: session.leaseLastUsedAt.toISOString() } : {}),
    ...(session.leaseReleasedAt ? { leaseReleasedAt: session.leaseReleasedAt.toISOString() } : {}),
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
      computeNetworkAllowlist: true,
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
      mcpBindings: {
        orderBy: [{ createdAt: "asc" }],
        select: {
          id: true,
          representativeId: true,
          representativeSkillPackLinkId: true,
          slug: true,
          displayName: true,
          description: true,
          serverUrl: true,
          transportKind: true,
          allowedToolNames: true,
          defaultToolName: true,
          enabled: true,
          approvalRequired: true,
          createdAt: true,
          updatedAt: true,
          representativeSkillPackLink: {
            select: {
              skillPack: {
                select: {
                  displayName: true,
                },
              },
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
          computeArtifactRetentionDays: true,
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
    networkAllowlist: representative.computeNetworkAllowlist,
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
    mcpBindings: representative.mcpBindings.map((binding) => serializeMcpBindingRecord(binding)),
  };
}

function serializeMcpBindingRecord(binding: RepresentativeIdentity["mcpBindings"][number]) {
  return {
    id: binding.id,
    representativeId: binding.representativeId,
    representativeSkillPackLinkId: binding.representativeSkillPackLinkId,
    slug: binding.slug,
    displayName: binding.displayName,
    description: binding.description,
    serverUrl: binding.serverUrl,
    transportKind: binding.transportKind.toLowerCase() as "streamable_http",
    allowedToolNames: Array.isArray(binding.allowedToolNames)
      ? binding.allowedToolNames.filter((value): value is string => typeof value === "string")
      : [],
    defaultToolName: binding.defaultToolName,
    enabled: binding.enabled,
    approvalRequired: binding.approvalRequired,
    createdAt: binding.createdAt.toISOString(),
    updatedAt: binding.updatedAt.toISOString(),
    ...(binding.representativeSkillPackLink?.skillPack.displayName
      ? { sourceSkillPack: binding.representativeSkillPackLink.skillPack.displayName }
      : {}),
  };
}

function buildArtifactFileName(artifact: {
  id: string;
  kind: string;
  objectKey: string;
  mimeType: string;
}) {
  const objectName = pathPosix.basename(artifact.objectKey);
  const objectExtension = objectName.includes(".") ? objectName.split(".").pop() : undefined;
  const extension =
    artifact.mimeType.includes("json")
      ? "json"
      : artifact.mimeType.includes("text/")
        ? "txt"
        : artifact.mimeType === "image/jpeg"
          ? "jpg"
          : artifact.mimeType === "image/png"
            ? "png"
            : objectExtension || "bin";
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
