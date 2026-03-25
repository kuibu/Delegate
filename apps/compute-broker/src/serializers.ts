import {
  approvalRequestSnapshotSchema,
  artifactSnapshotSchema,
  capabilityPolicyProfileSchema,
  computeSessionSnapshotSchema,
  mcpBindingSnapshotSchema,
  toolExecutionSnapshotSchema,
  type ComputeFilesystemMode,
  type McpTransportKind,
  type ComputeNetworkMode,
} from "@delegate/compute-protocol";

export function mapRequestedByToDb(value: "system" | "owner" | "audience") {
  return value.toUpperCase() as "SYSTEM" | "OWNER" | "AUDIENCE";
}

export function mapRequestedByFromDb(value: string) {
  return value.toLowerCase() as "system" | "owner" | "audience";
}

export function mapRunnerTypeToDb(value: "docker" | "vm") {
  return value.toUpperCase() as "DOCKER" | "VM";
}

export function mapRunnerTypeFromDb(value: string) {
  return value.toLowerCase() as "docker" | "vm";
}

export function mapSessionStatusFromDb(value: string) {
  return value.toLowerCase() as
    | "requested"
    | "starting"
    | "running"
    | "idle"
    | "stopping"
    | "completed"
    | "failed"
    | "expired";
}

export function mapLeaseStatusFromDb(value: string) {
  return value.toLowerCase() as "requested" | "ready" | "releasing" | "released" | "failed";
}

export function mapToolStatusFromDb(value: string) {
  return value.toLowerCase() as
    | "queued"
    | "running"
    | "succeeded"
    | "failed"
    | "blocked"
    | "canceled";
}

export function mapApprovalStatusFromDb(value: string) {
  return value.toLowerCase() as "pending" | "approved" | "rejected" | "expired";
}

export function mapCapabilityFromDb(value: string) {
  return value.toLowerCase() as "exec" | "read" | "write" | "process" | "browser" | "mcp";
}

export function mapCapabilityToDb(value: "exec" | "read" | "write" | "process" | "browser" | "mcp") {
  return value.toUpperCase() as "EXEC" | "READ" | "WRITE" | "PROCESS" | "BROWSER" | "MCP";
}

export function mapPolicyDecisionToDb(value: "allow" | "ask" | "deny") {
  return value.toUpperCase() as "ALLOW" | "ASK" | "DENY";
}

export function mapPolicyDecisionFromDb(value: string) {
  return value.toLowerCase() as "allow" | "ask" | "deny";
}

export function mapArtifactKindFromDb(value: string) {
  return value.toLowerCase() as
    | "stdout"
    | "stderr"
    | "file"
    | "archive"
    | "screenshot"
    | "json"
    | "trace";
}

export function mapNetworkModeFromDb(value: string) {
  return value.toLowerCase() as ComputeNetworkMode;
}

export function mapFilesystemModeFromDb(value: string) {
  return value.toLowerCase() as ComputeFilesystemMode;
}

export function mapMcpTransportKindFromDb(value: string) {
  return value.toLowerCase() as McpTransportKind;
}

export function serializeSession(session: {
  id: string;
  representativeId: string;
  contactId: string | null;
  conversationId: string | null;
  policyProfileId: string | null;
  requestedBy: string;
  status: string;
  leaseStatus: string;
  runnerType: string;
  runnerLeaseId: string | null;
  baseImage: string;
  containerId: string | null;
  createdAt: Date;
  updatedAt: Date;
  leaseAcquiredAt: Date | null;
  leaseLastUsedAt: Date | null;
  leaseReleasedAt: Date | null;
  startedAt: Date | null;
  lastHeartbeatAt: Date | null;
  expiresAt: Date | null;
  endedAt: Date | null;
  failureReason: string | null;
}) {
  return computeSessionSnapshotSchema.parse({
    id: session.id,
    representativeId: session.representativeId,
    contactId: session.contactId,
    conversationId: session.conversationId,
    policyProfileId: session.policyProfileId,
    requestedBy: mapRequestedByFromDb(session.requestedBy),
    status: mapSessionStatusFromDb(session.status),
    leaseStatus: mapLeaseStatusFromDb(session.leaseStatus),
    runnerType: mapRunnerTypeFromDb(session.runnerType),
    runnerLeaseId: session.runnerLeaseId,
    baseImage: session.baseImage,
    containerId: session.containerId,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    leaseAcquiredAt: session.leaseAcquiredAt?.toISOString() ?? null,
    leaseLastUsedAt: session.leaseLastUsedAt?.toISOString() ?? null,
    leaseReleasedAt: session.leaseReleasedAt?.toISOString() ?? null,
    startedAt: session.startedAt?.toISOString() ?? null,
    lastHeartbeatAt: session.lastHeartbeatAt?.toISOString() ?? null,
    expiresAt: session.expiresAt?.toISOString() ?? null,
    endedAt: session.endedAt?.toISOString() ?? null,
    failureReason: session.failureReason,
  });
}

export function serializeExecution(execution: {
  id: string;
  sessionId: string;
  mcpBindingId: string | null;
  capability: string;
  status: string;
  requestedCommand: string | null;
  requestedPath: string | null;
  workingDirectory: string | null;
  policyDecision: string | null;
  approvalRequestId: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  exitCode: number | null;
  cpuMs: number | null;
  wallMs: number | null;
  bytesRead: number | null;
  bytesWritten: number | null;
  createdAt: Date;
}) {
  return toolExecutionSnapshotSchema.parse({
    id: execution.id,
    sessionId: execution.sessionId,
    capability: mapCapabilityFromDb(execution.capability),
    status: mapToolStatusFromDb(execution.status),
    requestedCommand: execution.requestedCommand,
    requestedPath: execution.requestedPath,
    workingDirectory: execution.workingDirectory,
    mcpBindingId: execution.mcpBindingId,
    policyDecision: execution.policyDecision
      ? mapPolicyDecisionFromDb(execution.policyDecision)
      : null,
    approvalRequestId: execution.approvalRequestId,
    startedAt: execution.startedAt?.toISOString() ?? null,
    finishedAt: execution.finishedAt?.toISOString() ?? null,
    exitCode: execution.exitCode,
    cpuMs: execution.cpuMs,
    wallMs: execution.wallMs,
    bytesRead: execution.bytesRead,
    bytesWritten: execution.bytesWritten,
    createdAt: execution.createdAt.toISOString(),
  });
}

export function serializeMcpBinding(binding: {
  id: string;
  representativeId: string;
  representativeSkillPackLinkId: string | null;
  slug: string;
  displayName: string;
  description: string | null;
  serverUrl: string;
  transportKind: string;
  allowedToolNames: unknown;
  defaultToolName: string | null;
  enabled: boolean;
  approvalRequired: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return mcpBindingSnapshotSchema.parse({
    id: binding.id,
    representativeId: binding.representativeId,
    representativeSkillPackLinkId: binding.representativeSkillPackLinkId,
    slug: binding.slug,
    displayName: binding.displayName,
    description: binding.description,
    serverUrl: binding.serverUrl,
    transportKind: mapMcpTransportKindFromDb(binding.transportKind),
    allowedToolNames: Array.isArray(binding.allowedToolNames)
      ? binding.allowedToolNames.filter((value): value is string => typeof value === "string")
      : [],
    defaultToolName: binding.defaultToolName,
    enabled: binding.enabled,
    approvalRequired: binding.approvalRequired,
    createdAt: binding.createdAt.toISOString(),
    updatedAt: binding.updatedAt.toISOString(),
  });
}

export function serializeApprovalRequest(approvalRequest: {
  id: string;
  representativeId: string;
  contactId: string | null;
  conversationId: string | null;
  sessionId: string | null;
  toolExecutionId: string | null;
  status: string;
  reason: string;
  requestedActionSummary: string;
  riskSummary: string;
  requestedAt: Date;
  resolvedAt: Date | null;
  resolvedBy: string | null;
}) {
  return approvalRequestSnapshotSchema.parse({
    id: approvalRequest.id,
    representativeId: approvalRequest.representativeId,
    contactId: approvalRequest.contactId,
    conversationId: approvalRequest.conversationId,
    sessionId: approvalRequest.sessionId,
    toolExecutionId: approvalRequest.toolExecutionId,
    status: mapApprovalStatusFromDb(approvalRequest.status),
    reason: approvalRequest.reason,
    requestedActionSummary: approvalRequest.requestedActionSummary,
    riskSummary: approvalRequest.riskSummary,
    requestedAt: approvalRequest.requestedAt.toISOString(),
    resolvedAt: approvalRequest.resolvedAt?.toISOString() ?? null,
    resolvedBy: approvalRequest.resolvedBy,
  });
}

export function serializeArtifact(artifact: {
  id: string;
  representativeId: string;
  contactId: string | null;
  conversationId: string | null;
  sessionId: string | null;
  toolExecutionId: string | null;
  kind: string;
  bucket: string;
  objectKey: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  isPinned: boolean;
  pinnedAt: Date | null;
  pinnedBy: string | null;
  downloadCount: number;
  lastDownloadedAt: Date | null;
  retentionUntil: Date | null;
  summary: string | null;
  createdAt: Date;
}) {
  return artifactSnapshotSchema.parse({
    id: artifact.id,
    representativeId: artifact.representativeId,
    contactId: artifact.contactId,
    conversationId: artifact.conversationId,
    sessionId: artifact.sessionId,
    toolExecutionId: artifact.toolExecutionId,
    kind: mapArtifactKindFromDb(artifact.kind),
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
  });
}

export function serializeCapabilityProfile(profile: {
  id: string;
  representativeId: string;
  name: string;
  isDefault: boolean;
  isManaged: boolean;
  managedSource: string | null;
  precedence: number;
  defaultDecision: string;
  maxSessionMinutes: number;
  maxParallelSessions: number;
  maxCommandSeconds: number;
  artifactRetentionDays: number;
  networkMode: string;
  networkAllowlist: string[];
  filesystemMode: string;
  rules: Array<{
    id: string;
    capability: string;
    decision: string;
    commandPattern: string | null;
    pathPattern: string | null;
    domainPattern: string | null;
    channelCondition: string | null;
    requiredPlanTier: string | null;
    maxCostCents: number | null;
    requiresPaidPlan: boolean;
    requiresHumanApproval: boolean;
    priority: number;
  }>;
}) {
  return capabilityPolicyProfileSchema.parse({
    id: profile.id,
    representativeId: profile.representativeId,
    name: profile.name,
    isDefault: profile.isDefault,
    isManaged: profile.isManaged,
    ...(profile.managedSource ? { managedSource: profile.managedSource } : {}),
    precedence: profile.precedence,
    defaultDecision: mapPolicyDecisionFromDb(profile.defaultDecision),
    maxSessionMinutes: profile.maxSessionMinutes,
    maxParallelSessions: profile.maxParallelSessions,
    maxCommandSeconds: profile.maxCommandSeconds,
    artifactRetentionDays: profile.artifactRetentionDays,
    networkMode: mapNetworkModeFromDb(profile.networkMode),
    networkAllowlist: profile.networkAllowlist,
    filesystemMode: mapFilesystemModeFromDb(profile.filesystemMode),
    rules: profile.rules.map((rule) => ({
      id: rule.id,
      capability: mapCapabilityFromDb(rule.capability),
      decision: mapPolicyDecisionFromDb(rule.decision),
      ...(rule.commandPattern ? { commandPattern: rule.commandPattern } : {}),
      ...(rule.pathPattern ? { pathPattern: rule.pathPattern } : {}),
      ...(rule.domainPattern ? { domainPattern: rule.domainPattern } : {}),
      ...(rule.channelCondition
        ? { channelCondition: rule.channelCondition.toLowerCase() as any }
        : {}),
      ...(rule.requiredPlanTier
        ? { requiredPlanTier: rule.requiredPlanTier.toLowerCase() as any }
        : {}),
      ...(typeof rule.maxCostCents === "number" ? { maxCostCents: rule.maxCostCents } : {}),
      requiresPaidPlan: rule.requiresPaidPlan,
      requiresHumanApproval: rule.requiresHumanApproval,
      priority: rule.priority,
    })),
  });
}
