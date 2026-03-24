import { createHash, randomBytes } from "node:crypto";
import {
  createComputeSessionRequestSchema,
  createComputeSessionResponseSchema,
} from "@delegate/compute-protocol";
import { prisma } from "./prisma";
import { computeBrokerConfig } from "./config";
import { SessionError } from "./session-error";
import {
  mapRequestedByToDb,
  mapRunnerTypeFromDb,
  mapRunnerTypeToDb,
  mapSessionStatusFromDb,
  serializeSession,
} from "./serializers";
import { computeLifecycleHooks } from "./lifecycle-hooks";

export async function createComputeSession(rawInput: unknown) {
  const input = createComputeSessionRequestSchema.parse(rawInput);
  const representative = await prisma.representative.findUnique({
    where: { id: input.representativeId },
    select: {
      id: true,
      slug: true,
      computeEnabled: true,
      computeBaseImage: true,
      computeMaxSessionMinutes: true,
      capabilityProfiles: {
        where: { isDefault: true },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true },
      },
    },
  });

  if (!representative) {
    throw new SessionError(404, "representative_not_found");
  }

  if (!representative.computeEnabled) {
    throw new SessionError(409, "compute_disabled_for_representative");
  }

  const defaultPolicyProfileId = representative.capabilityProfiles[0]?.id;
  if (!defaultPolicyProfileId) {
    throw new SessionError(409, "capability_policy_profile_missing");
  }

  const leaseToken = randomBytes(24).toString("hex");
  const leaseTokenHash = sha256(leaseToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + representative.computeMaxSessionMinutes * 60 * 1000);

  const session = await prisma.computeSession.create({
    data: {
      representativeId: input.representativeId,
      contactId: input.contactId ?? null,
      conversationId: input.conversationId ?? null,
      policyProfileId: defaultPolicyProfileId,
      requestedBy: mapRequestedByToDb(input.requestedBy),
      status: "REQUESTED",
      runnerType: mapRunnerTypeToDb(computeBrokerConfig.runnerType),
      baseImage: input.requestedBaseImage ?? representative.computeBaseImage,
      leaseTokenHash,
      expiresAt,
    },
  });

  await prisma.eventAudit.create({
    data: {
      representativeId: input.representativeId,
      contactId: input.contactId ?? null,
      conversationId: input.conversationId ?? null,
      type: "COMPUTE_SESSION_REQUESTED",
      payload: {
        requestedCapabilities: input.requestedCapabilities,
        requestedBy: input.requestedBy,
        reason: input.reason,
        sessionId: session.id,
      },
    },
  });

  const response = createComputeSessionResponseSchema.parse({
    session: serializeSession(session),
    lease: {
      sessionId: session.id,
      status: "requested",
      runnerType: computeBrokerConfig.runnerType,
      baseImage: session.baseImage,
      leaseToken,
      expiresAt: session.expiresAt?.toISOString(),
    },
  });

  return response;
}

export async function getComputeSession(sessionId: string) {
  const session = await prisma.computeSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new SessionError(404, "compute_session_not_found");
  }

  return serializeSession(session);
}

export async function terminateComputeSession(sessionId: string, reason?: string) {
  const session = await prisma.computeSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new SessionError(404, "compute_session_not_found");
  }

  const endedAt = new Date();
  const updated = await prisma.computeSession.update({
    where: { id: sessionId },
    data: {
      status: session.status === "FAILED" ? session.status : "COMPLETED",
      endedAt,
      failureReason: session.status === "FAILED" ? session.failureReason : reason ?? session.failureReason,
    },
  });

  await computeLifecycleHooks.emit({
    kind: "session_ended",
    scope: {
      representativeId: updated.representativeId,
      contactId: updated.contactId ?? null,
      conversationId: updated.conversationId ?? null,
    },
    sessionId: updated.id,
    reason: reason ?? "manual_terminate",
    finalStatus: mapSessionStatusFromDb(updated.status),
  });

  return serializeSession(updated);
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
