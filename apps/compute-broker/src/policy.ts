import { evaluateCapabilityPolicy } from "@delegate/capability-policy";
import { toolExecutionRequestSchema } from "@delegate/compute-protocol";

import { prisma } from "./prisma";
import { SessionError } from "./sessions";
import { serializeCapabilityProfile } from "./serializers";

export async function loadSessionPolicyContext(sessionId: string) {
  const session = await prisma.computeSession.findUnique({
    where: { id: sessionId },
    include: {
      representative: true,
      contact: true,
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
  };
}

export async function evaluateExecutionRequest(sessionId: string, rawInput: unknown) {
  const input = toolExecutionRequestSchema.parse(rawInput);
  const context = await loadSessionPolicyContext(sessionId);
  const hasPaidEntitlement = input.hasPaidEntitlement || Boolean(context.session.contact?.isPaid);
  const decision = evaluateCapabilityPolicy(context.profile, {
    capability: input.capability,
    command: input.command,
    path: input.path,
    domain: input.domain,
    estimatedCostCents: input.estimatedCostCents,
    hasPaidEntitlement,
  });

  return {
    input,
    context,
    decision,
  };
}
