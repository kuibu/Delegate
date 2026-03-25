import type { ComputeFilesystemMode, ComputeNetworkMode } from "@delegate/compute-protocol";
import type { ComputeSession } from "@prisma/client";

import { computeBrokerConfig } from "./config";
import { prisma } from "./prisma";
import { acquireRunnerLease, releaseRunnerLease } from "./runner";
import { mapLeaseStatusFromDb, mapRunnerTypeFromDb } from "./serializers";

type LeaseManagedSession = ComputeSession;

export async function ensureComputeSessionLease(params: {
  session: LeaseManagedSession;
  networkMode: ComputeNetworkMode;
  filesystemMode: ComputeFilesystemMode;
}) {
  if (
    mapLeaseStatusFromDb(params.session.leaseStatus) === "ready" &&
    params.session.runnerLeaseId &&
    params.session.containerId
  ) {
    return params.session;
  }

  const now = new Date();
  const lease = await acquireRunnerLease({
    runnerType: mapRunnerTypeFromDb(params.session.runnerType),
    image: params.session.baseImage,
    hostWorkspaceRoot: computeBrokerConfig.hostWorkspaceRoot,
    networkMode: params.networkMode,
    filesystemMode: params.filesystemMode,
    sessionId: params.session.id,
  });

  const updated = await prisma.computeSession.update({
    where: { id: params.session.id },
    data: {
      status:
        params.session.status === "RUNNING" ? "RUNNING" : params.session.status === "COMPLETED" ? "COMPLETED" : "IDLE",
      leaseStatus: "READY",
      runnerLeaseId: lease.leaseId,
      containerId: lease.containerId,
      leaseAcquiredAt: params.session.leaseAcquiredAt ?? now,
      lastHeartbeatAt: now,
      failureReason: null,
    },
  });

  await prisma.eventAudit.create({
    data: {
      representativeId: params.session.representativeId,
      contactId: params.session.contactId ?? null,
      conversationId: params.session.conversationId ?? null,
      type: "COMPUTE_SESSION_STARTED",
      payload: {
        sessionId: params.session.id,
        leaseId: lease.leaseId,
        containerId: lease.containerId,
        runnerType: lease.runnerType,
      },
    },
  });

  return updated;
}

export async function releaseComputeSessionLease(session: LeaseManagedSession) {
  const runnerType = mapRunnerTypeFromDb(session.runnerType);
  if (runnerType !== "docker") {
    throw new Error(`Unsupported compute runner type: ${runnerType}`);
  }

  await releaseRunnerLease({
    runnerType,
    sessionId: session.id,
    leaseId: session.runnerLeaseId,
    containerId: session.containerId,
  });

  return prisma.computeSession.update({
    where: { id: session.id },
    data: {
      leaseStatus: "RELEASED",
      leaseReleasedAt: new Date(),
      containerId: null,
      lastHeartbeatAt: new Date(),
    },
  });
}
