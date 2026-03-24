import { z } from "zod";

export const capabilityKindSchema = z.enum(["exec", "read", "write", "process", "browser"]);
export const policyDecisionSchema = z.enum(["allow", "ask", "deny"]);
export const computeSessionStatusSchema = z.enum([
  "requested",
  "starting",
  "running",
  "idle",
  "stopping",
  "completed",
  "failed",
  "expired",
]);
export const toolExecutionStatusSchema = z.enum([
  "queued",
  "running",
  "succeeded",
  "failed",
  "blocked",
  "canceled",
]);
export const approvalStatusSchema = z.enum(["pending", "approved", "rejected", "expired"]);
export const artifactKindSchema = z.enum([
  "stdout",
  "stderr",
  "file",
  "archive",
  "screenshot",
  "json",
  "trace",
]);
export const computeRequestedBySchema = z.enum(["system", "owner", "audience"]);
export const computeRunnerTypeSchema = z.enum(["docker", "vm"]);
export const computeNetworkModeSchema = z.enum(["no_network", "allowlist", "full"]);
export const computeFilesystemModeSchema = z.enum([
  "workspace_only",
  "read_only_workspace",
  "ephemeral_full",
]);
export const computeExecutionOutcomeSchema = z.enum([
  "completed",
  "failed",
  "blocked",
  "pending_approval",
]);

export const capabilityPolicyRuleSchema = z.object({
  id: z.string(),
  capability: capabilityKindSchema,
  decision: policyDecisionSchema,
  commandPattern: z.string().optional(),
  pathPattern: z.string().optional(),
  domainPattern: z.string().optional(),
  maxCostCents: z.number().int().nonnegative().optional(),
  requiresPaidPlan: z.boolean().default(false),
  requiresHumanApproval: z.boolean().default(false),
  priority: z.number().int(),
});

export const capabilityPolicyProfileSchema = z.object({
  id: z.string(),
  representativeId: z.string(),
  name: z.string(),
  isDefault: z.boolean(),
  defaultDecision: policyDecisionSchema,
  maxSessionMinutes: z.number().int().positive(),
  maxParallelSessions: z.number().int().positive(),
  maxCommandSeconds: z.number().int().positive(),
  artifactRetentionDays: z.number().int().positive(),
  networkMode: computeNetworkModeSchema,
  filesystemMode: computeFilesystemModeSchema,
  rules: z.array(capabilityPolicyRuleSchema).default([]),
});

export const createComputeSessionRequestSchema = z.object({
  representativeId: z.string(),
  contactId: z.string().optional(),
  conversationId: z.string().optional(),
  requestedBy: computeRequestedBySchema,
  requestedCapabilities: z.array(capabilityKindSchema).min(1),
  reason: z.string().min(1),
  requestedBaseImage: z.string().optional(),
});

export const computeSessionLeaseSchema = z.object({
  sessionId: z.string(),
  status: computeSessionStatusSchema,
  runnerType: computeRunnerTypeSchema,
  baseImage: z.string(),
  leaseToken: z.string(),
  expiresAt: z.string().datetime().optional(),
});

export const computeSessionSnapshotSchema = z.object({
  id: z.string(),
  representativeId: z.string(),
  contactId: z.string().nullable(),
  conversationId: z.string().nullable(),
  policyProfileId: z.string().nullable(),
  requestedBy: computeRequestedBySchema,
  status: computeSessionStatusSchema,
  runnerType: computeRunnerTypeSchema,
  baseImage: z.string(),
  containerId: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  startedAt: z.string().datetime().nullable(),
  lastHeartbeatAt: z.string().datetime().nullable(),
  expiresAt: z.string().datetime().nullable(),
  endedAt: z.string().datetime().nullable(),
  failureReason: z.string().nullable(),
});

export const createComputeSessionResponseSchema = z.object({
  session: computeSessionSnapshotSchema,
  lease: computeSessionLeaseSchema,
});

export const terminateComputeSessionRequestSchema = z.object({
  reason: z.string().min(1).optional(),
});

export const toolExecutionRequestSchema = z.object({
  capability: capabilityKindSchema,
  command: z.string().min(1).optional(),
  path: z.string().min(1).optional(),
  domain: z.string().min(1).optional(),
  workingDirectory: z.string().min(1).optional(),
  estimatedCostCents: z.number().int().nonnegative().optional(),
  hasPaidEntitlement: z.boolean().default(false),
});

export const approvalRequestSnapshotSchema = z.object({
  id: z.string(),
  representativeId: z.string(),
  contactId: z.string().nullable(),
  conversationId: z.string().nullable(),
  sessionId: z.string().nullable(),
  toolExecutionId: z.string().nullable(),
  status: approvalStatusSchema,
  reason: z.string(),
  requestedActionSummary: z.string(),
  riskSummary: z.string(),
  requestedAt: z.string().datetime(),
  resolvedAt: z.string().datetime().nullable(),
  resolvedBy: z.string().nullable(),
});

export const resolveApprovalRequestSchema = z.object({
  resolution: z.enum(["approved", "rejected"]),
  resolvedBy: z.string().trim().min(1).optional(),
});

export const artifactSnapshotSchema = z.object({
  id: z.string(),
  representativeId: z.string(),
  contactId: z.string().nullable(),
  conversationId: z.string().nullable(),
  sessionId: z.string().nullable(),
  toolExecutionId: z.string().nullable(),
  kind: artifactKindSchema,
  bucket: z.string(),
  objectKey: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  sha256: z.string(),
  retentionUntil: z.string().datetime().nullable(),
  summary: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export const toolExecutionSnapshotSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  capability: capabilityKindSchema,
  status: toolExecutionStatusSchema,
  requestedCommand: z.string().nullable(),
  requestedPath: z.string().nullable(),
  workingDirectory: z.string().nullable(),
  policyDecision: policyDecisionSchema.nullable(),
  approvalRequestId: z.string().nullable(),
  startedAt: z.string().datetime().nullable(),
  finishedAt: z.string().datetime().nullable(),
  exitCode: z.number().int().nullable(),
  cpuMs: z.number().int().nullable(),
  wallMs: z.number().int().nullable(),
  bytesRead: z.number().int().nullable(),
  bytesWritten: z.number().int().nullable(),
  createdAt: z.string().datetime(),
});

export const executeToolResponseSchema = z.object({
  outcome: computeExecutionOutcomeSchema,
  session: computeSessionSnapshotSchema,
  execution: toolExecutionSnapshotSchema,
  approvalRequest: approvalRequestSnapshotSchema.nullable().optional(),
  artifacts: z.array(artifactSnapshotSchema).default([]),
});

export const resolveApprovalResponseSchema = z.object({
  outcome: z.enum(["approved_and_executed", "approved", "rejected"]),
  approvalRequest: approvalRequestSnapshotSchema,
  session: computeSessionSnapshotSchema.nullable().optional(),
  execution: toolExecutionSnapshotSchema.nullable().optional(),
  artifacts: z.array(artifactSnapshotSchema).default([]),
});

export const listArtifactsResponseSchema = z.object({
  session: computeSessionSnapshotSchema,
  artifacts: z.array(artifactSnapshotSchema),
});

export const listApprovalsResponseSchema = z.object({
  session: computeSessionSnapshotSchema,
  approvals: z.array(approvalRequestSnapshotSchema),
});

export const brokerHealthSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("compute-broker"),
  runnerType: computeRunnerTypeSchema,
  artifactBucket: z.string(),
});

export type CapabilityKind = z.infer<typeof capabilityKindSchema>;
export type PolicyDecision = z.infer<typeof policyDecisionSchema>;
export type ComputeSessionStatus = z.infer<typeof computeSessionStatusSchema>;
export type ToolExecutionStatus = z.infer<typeof toolExecutionStatusSchema>;
export type ApprovalStatus = z.infer<typeof approvalStatusSchema>;
export type ArtifactKind = z.infer<typeof artifactKindSchema>;
export type ComputeRequestedBy = z.infer<typeof computeRequestedBySchema>;
export type ComputeRunnerType = z.infer<typeof computeRunnerTypeSchema>;
export type ComputeNetworkMode = z.infer<typeof computeNetworkModeSchema>;
export type ComputeFilesystemMode = z.infer<typeof computeFilesystemModeSchema>;
export type ComputeExecutionOutcome = z.infer<typeof computeExecutionOutcomeSchema>;
export type CapabilityPolicyRule = z.infer<typeof capabilityPolicyRuleSchema>;
export type CapabilityPolicyProfile = z.infer<typeof capabilityPolicyProfileSchema>;
export type CreateComputeSessionRequest = z.infer<typeof createComputeSessionRequestSchema>;
export type ComputeSessionLease = z.infer<typeof computeSessionLeaseSchema>;
export type ComputeSessionSnapshot = z.infer<typeof computeSessionSnapshotSchema>;
export type CreateComputeSessionResponse = z.infer<typeof createComputeSessionResponseSchema>;
export type TerminateComputeSessionRequest = z.infer<typeof terminateComputeSessionRequestSchema>;
export type ToolExecutionRequest = z.infer<typeof toolExecutionRequestSchema>;
export type ToolExecutionSnapshot = z.infer<typeof toolExecutionSnapshotSchema>;
export type ApprovalRequestSnapshot = z.infer<typeof approvalRequestSnapshotSchema>;
export type ResolveApprovalRequest = z.infer<typeof resolveApprovalRequestSchema>;
export type ResolveApprovalResponse = z.infer<typeof resolveApprovalResponseSchema>;
export type ArtifactSnapshot = z.infer<typeof artifactSnapshotSchema>;
export type ExecuteToolResponse = z.infer<typeof executeToolResponseSchema>;
export type ListArtifactsResponse = z.infer<typeof listArtifactsResponseSchema>;
export type ListApprovalsResponse = z.infer<typeof listApprovalsResponseSchema>;
export type BrokerHealth = z.infer<typeof brokerHealthSchema>;
