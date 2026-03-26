import { evaluateCapabilityPolicyStack } from "@delegate/capability-policy";
import {
  computeSubagentIdSchema,
  resolveComputeSubagentIdForCapability,
  toolExecutionRequestSchema,
  type CapabilityKind,
  type ComputeSubagentId,
} from "@delegate/compute-protocol";

import { deriveConversationComputeEntitlements } from "./entitlements";
import { loadRepresentativeMcpBinding, resolveMcpToolName } from "./mcp-bindings";
import { normalizeContainerPath } from "./path-utils";
import { prisma } from "./prisma";
import { SessionError } from "./session-error";
import { serializeCapabilityProfile } from "./serializers";

export async function loadSessionPolicyContext(sessionId: string) {
  const session = await prisma.computeSession.findUnique({
    where: { id: sessionId },
    include: {
      representative: {
        include: {
          owner: {
            include: {
              wallet: true,
              organization: {
                include: {
                  capabilityProfiles: {
                    where: {
                      isManaged: true,
                      enabled: true,
                    },
                    orderBy: [{ precedence: "desc" }, { createdAt: "asc" }],
                    include: {
                      rules: {
                        orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
                      },
                    },
                  },
                },
              },
              capabilityProfiles: {
                where: {
                  isManaged: true,
                  enabled: true,
                },
                orderBy: [{ precedence: "desc" }, { createdAt: "asc" }],
                include: {
                  rules: {
                    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
                  },
                },
              },
            },
          },
          capabilityProfiles: {
            where: {
              isManaged: true,
              enabled: true,
            },
            orderBy: [{ precedence: "desc" }, { createdAt: "asc" }],
            include: {
              rules: {
                orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
              },
            },
          },
        },
      },
      contact: {
        include: {
          customerAccount: {
            include: {
              capabilityProfiles: {
                where: {
                  isManaged: true,
                  enabled: true,
                },
                orderBy: [{ precedence: "desc" }, { createdAt: "asc" }],
                include: {
                  rules: {
                    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
                  },
                },
              },
            },
          },
        },
      },
      conversation: true,
      policyProfile: {
        include: {
          rules: {
            orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
          },
        },
      },
    },
  });

  if (!session) {
    throw new SessionError(404, "compute_session_not_found");
  }

  if (session.endedAt) {
    throw new SessionError(409, "compute_session_already_terminated");
  }

  if (session.expiresAt && session.expiresAt.getTime() < Date.now()) {
    throw new SessionError(409, "compute_session_expired");
  }

  if (!session.policyProfile) {
    throw new SessionError(409, "capability_policy_profile_missing");
  }

  return {
    session,
    profile: serializeCapabilityProfile(session.policyProfile),
    managedProfiles: [
      ...(session.representative.owner.organization?.capabilityProfiles ?? []),
      ...session.representative.owner.capabilityProfiles,
      ...(session.contact?.customerAccount?.capabilityProfiles ?? []),
      ...session.representative.capabilityProfiles,
    ].map((profile) =>
      serializeCapabilityProfile(profile),
    ),
  };
}

export async function evaluateExecutionRequest(sessionId: string, rawInput: unknown) {
  const input = toolExecutionRequestSchema.parse(rawInput);
  const normalizedPath =
    (input.capability === "read" || input.capability === "write") && input.path
      ? normalizeContainerPath(input.path)
      : input.path;
  const context = await loadSessionPolicyContext(sessionId);
  const entitlements = deriveConversationComputeEntitlements({
    conversation: context.session.conversation,
    requestedPaidEntitlement: input.hasPaidEntitlement,
  });
  const mcpBinding =
    input.capability === "mcp"
      ? await loadRepresentativeMcpBinding({
          representativeId: context.session.representativeId,
          bindingId: input.bindingId,
          bindingSlug: input.bindingSlug,
        })
      : null;
  const mcpToolName =
    input.capability === "mcp" && mcpBinding
      ? resolveMcpToolName({
          binding: mcpBinding,
          requestedToolName: input.toolName,
        }).toolName
      : undefined;
  const bindingDomain = mcpBinding ? new URL(mcpBinding.serverUrl).hostname : undefined;
  const decision = evaluateCapabilityPolicyStack(
    [...context.managedProfiles, context.profile],
    {
      capability: input.capability,
      command: input.capability === "mcp" ? mcpToolName : input.command,
      path: normalizedPath,
      domain: input.capability === "mcp" ? bindingDomain : input.domain,
      resourceScope: resolvePolicyResourceScope(input.capability),
      ...(context.session.conversation?.channel
        ? {
            channel: context.session.conversation.channel.toLowerCase() as
              | "private_chat"
              | "group_mention"
              | "group_reply"
              | "channel_entry",
          }
        : {}),
      ...(entitlements.activePlanTier ? { activePlanTier: entitlements.activePlanTier } : {}),
      estimatedCostCents: input.estimatedCostCents,
      hasPaidEntitlement: entitlements.hasPaidEntitlement,
      contactTrustTier: normalizeContactTrustTier(context.session.contact?.computeTrustTier),
      ...(context.session.contact?.customerAccountId
        ? { customerAccountId: context.session.contact.customerAccountId }
        : {}),
    },
  );

  const sessionSubagentId = resolveSessionComputeSubagentId(
    context.session.subagentId,
    input.capability,
  );
  assertExecutionSubagentRoute({
    sessionSubagentId,
    requestedSubagentId: input.subagentId,
    capability: input.capability,
  });

  return {
    input: {
      ...input,
      ...(normalizedPath ? { path: normalizedPath } : {}),
      ...(input.capability === "mcp" && mcpBinding ? { bindingId: mcpBinding.id } : {}),
      ...(input.capability === "mcp" && bindingDomain ? { domain: bindingDomain } : {}),
      ...(input.capability === "mcp" && mcpToolName ? { toolName: mcpToolName } : {}),
    },
    context,
    decision,
    entitlements,
    mcpBinding,
    sessionSubagentId,
  };
}

export function resolveSessionComputeSubagentId(
  rawSubagentId: string | null | undefined,
  capability: CapabilityKind,
): ComputeSubagentId {
  if (rawSubagentId) {
    return computeSubagentIdSchema.parse(rawSubagentId);
  }

  return resolveComputeSubagentIdForCapability(capability);
}

export function assertExecutionSubagentRoute(params: {
  sessionSubagentId: ComputeSubagentId;
  requestedSubagentId: ComputeSubagentId;
  capability: CapabilityKind;
}) {
  if (params.sessionSubagentId !== params.requestedSubagentId) {
    throw new SessionError(409, "compute_subagent_session_mismatch");
  }

  const expectedSubagentId = resolveComputeSubagentIdForCapability(params.capability);
  if (params.requestedSubagentId !== expectedSubagentId) {
    throw new SessionError(409, "compute_subagent_capability_mismatch");
  }
}

function resolvePolicyResourceScope(capability: CapabilityKind) {
  if (capability === "browser") {
    return "browser_lane" as const;
  }

  if (capability === "mcp") {
    return "remote_mcp" as const;
  }

  return "workspace" as const;
}

function normalizeContactTrustTier(
  rawTrustTier: string | null | undefined,
): "standard" | "verified" | "vip" | "restricted" {
  const normalized = rawTrustTier?.trim().toLowerCase();
  if (
    normalized === "verified" ||
    normalized === "vip" ||
    normalized === "restricted"
  ) {
    return normalized;
  }

  return "standard";
}
