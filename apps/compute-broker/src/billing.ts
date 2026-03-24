import type { CapabilityKind } from "@delegate/compute-protocol";

import { prisma } from "./prisma";

type BudgetContext = {
  conversationId?: string | null;
  representative: {
    owner: {
      id: string;
      wallet: {
        balanceCredits: number;
        sponsorPoolCredit: number;
      } | null;
    };
  };
  conversation?: {
    computeBudgetRemainingCredits: number | null;
  } | null;
};

export type ExecutionBillingSummary = {
  estimatedCredits?: number;
  actualCredits?: number;
  computeCostCents?: number;
  storageCostCents?: number;
  conversationBudgetRemainingCredits?: number | null;
  ownerBalanceCredits?: number | null;
  sponsorPoolCredit?: number | null;
};

export function estimateCreditUsage(params: {
  capability: CapabilityKind;
  estimatedCostCents?: number;
  artifactBytes?: number;
}): number {
  const base =
    params.capability === "browser"
      ? 8
      : params.capability === "write"
        ? 4
        : params.capability === "process"
          ? 3
          : params.capability === "read"
            ? 2
            : 2;
  const costComponent =
    typeof params.estimatedCostCents === "number"
      ? Math.max(base, Math.ceil(params.estimatedCostCents / 2))
      : base;
  const artifactComponent =
    typeof params.artifactBytes === "number" && params.artifactBytes > 0
      ? Math.ceil(params.artifactBytes / 65536)
      : 0;

  return Math.max(base, costComponent + artifactComponent);
}

export function summarizeBudgetAvailability(context: BudgetContext) {
  const conversationCredits = context.conversation?.computeBudgetRemainingCredits ?? null;
  const ownerBalanceCredits = context.representative.owner.wallet?.balanceCredits ?? null;
  const sponsorPoolCredit = context.representative.owner.wallet?.sponsorPoolCredit ?? null;
  const totalAvailableCredits =
    Math.max(0, conversationCredits ?? 0) +
    Math.max(0, ownerBalanceCredits ?? 0) +
    Math.max(0, sponsorPoolCredit ?? 0);

  return {
    conversationCredits,
    ownerBalanceCredits,
    sponsorPoolCredit,
    totalAvailableCredits,
  };
}

export async function applyExecutionBilling(params: {
  representativeId: string;
  contactId?: string | null;
  conversationId?: string | null;
  sessionId: string;
  toolExecutionId: string;
  ownerId: string;
  computeCredits: number;
  storageCredits: number;
  computeCostCents: number;
  storageCostCents: number;
  finishedAt: Date;
}) {
  return prisma.$transaction(async (tx) => {
    const conversation =
      params.conversationId
        ? await tx.conversation.findUnique({
            where: { id: params.conversationId },
            select: {
              id: true,
              computeBudgetRemainingCredits: true,
            },
          })
        : null;
    const wallet = await tx.wallet.findUnique({
      where: { ownerId: params.ownerId },
      select: {
        ownerId: true,
        balanceCredits: true,
        sponsorPoolCredit: true,
      },
    });

    let remainingConversationCredits = conversation?.computeBudgetRemainingCredits ?? null;
    let remainingOwnerBalanceCredits = wallet?.balanceCredits ?? null;
    let remainingSponsorPoolCredits = wallet?.sponsorPoolCredit ?? null;
    let creditsLeftToCharge = params.computeCredits + params.storageCredits;

    if (
      typeof remainingConversationCredits === "number" &&
      remainingConversationCredits > 0 &&
      creditsLeftToCharge > 0
    ) {
      const debit = Math.min(remainingConversationCredits, creditsLeftToCharge);
      remainingConversationCredits -= debit;
      creditsLeftToCharge -= debit;
    }

    if (
      typeof remainingOwnerBalanceCredits === "number" &&
      remainingOwnerBalanceCredits > 0 &&
      creditsLeftToCharge > 0
    ) {
      const debit = Math.min(remainingOwnerBalanceCredits, creditsLeftToCharge);
      remainingOwnerBalanceCredits -= debit;
      creditsLeftToCharge -= debit;
    }

    if (
      typeof remainingSponsorPoolCredits === "number" &&
      remainingSponsorPoolCredits > 0 &&
      creditsLeftToCharge > 0
    ) {
      const debit = Math.min(remainingSponsorPoolCredits, creditsLeftToCharge);
      remainingSponsorPoolCredits -= debit;
      creditsLeftToCharge -= debit;
    }

    if (conversation?.id) {
      await tx.conversation.update({
        where: { id: conversation.id },
        data: {
          computeBudgetRemainingCredits:
            typeof remainingConversationCredits === "number"
              ? remainingConversationCredits
              : conversation.computeBudgetRemainingCredits,
          lastComputeAt: params.finishedAt,
        },
      });
    }

    if (wallet) {
      await tx.wallet.update({
        where: { ownerId: params.ownerId },
        data: {
          balanceCredits:
            typeof remainingOwnerBalanceCredits === "number"
              ? remainingOwnerBalanceCredits
              : wallet.balanceCredits,
          sponsorPoolCredit:
            typeof remainingSponsorPoolCredits === "number"
              ? remainingSponsorPoolCredits
              : wallet.sponsorPoolCredit,
        },
      });
    }

    await tx.ledgerEntry.create({
      data: {
        representativeId: params.representativeId,
        contactId: params.contactId ?? null,
        conversationId: params.conversationId ?? null,
        sessionId: params.sessionId,
        toolExecutionId: params.toolExecutionId,
        kind: "COMPUTE_MINUTES",
        quantity: params.computeCredits,
        unit: "credit",
        costCents: params.computeCostCents,
        creditDelta: -params.computeCredits,
        notes:
          creditsLeftToCharge > 0
            ? `partial_charge_unsettled:${creditsLeftToCharge}`
            : "compute_usage_charge",
      },
    });

    await tx.ledgerEntry.create({
      data: {
        representativeId: params.representativeId,
        contactId: params.contactId ?? null,
        conversationId: params.conversationId ?? null,
        sessionId: params.sessionId,
        toolExecutionId: params.toolExecutionId,
        kind: "STORAGE_BYTES",
        quantity: params.storageCredits,
        unit: "credit",
        costCents: params.storageCostCents,
        creditDelta: -params.storageCredits,
        notes: "artifact_storage_charge",
      },
    });

    return {
      actualCredits: params.computeCredits + params.storageCredits,
      computeCostCents: params.computeCostCents,
      storageCostCents: params.storageCostCents,
      conversationBudgetRemainingCredits: remainingConversationCredits,
      ownerBalanceCredits: remainingOwnerBalanceCredits,
      sponsorPoolCredit: remainingSponsorPoolCredits,
    } satisfies ExecutionBillingSummary;
  });
}
