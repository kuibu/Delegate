import type { PlanTier } from "@delegate/domain";
import type {
  ConversationPlan,
  ConversationUsage,
  StructuredCollectorState,
} from "@delegate/runtime";
import {
  buildStructuredCollectorHandoffSummary,
  buildStructuredCollectorOwnerAction,
  calculateStructuredCollectorPriority,
  formatStructuredCollectorSummary,
  readStructuredCollectorState,
} from "@delegate/runtime";
import {
  AudienceRole,
  Channel,
  ContactStage,
  EventType,
  HandoffStatus,
  InvoiceStatus,
  Prisma,
  PricingPlanType,
} from "@prisma/client";

import { prisma } from "./prisma";

export type TelegramActor = {
  telegramUserId: number;
  username?: string;
  displayName?: string;
  chatId: number | string;
  channel: Channel;
};

export type ConversationContextRecord = {
  representativeId: string;
  representativeSlug: string;
  contactId: string;
  conversationId: string;
  contactIsPaid: boolean;
  usage: ConversationUsage;
  collectorState: StructuredCollectorState | null;
  plans: {
    free?: StoredPlan;
    pass?: StoredPlan;
    deep_help?: StoredPlan;
    sponsor?: StoredPlan;
  };
};

type StoredPlan = {
  id: string;
  tier: PlanTier;
  name: string;
  starsAmount: number;
  includedReplies: number;
  includesPriorityHandoff: boolean;
};

type SuccessfulPaymentInput = {
  invoicePayload: string;
  totalAmount: number;
  telegramPaymentChargeId: string;
  providerPaymentChargeId?: string;
};

export async function getConversationContext(
  representativeSlug: string,
  actor: TelegramActor,
): Promise<ConversationContextRecord> {
  const representative = await prisma.representative.findUnique({
    where: { slug: representativeSlug },
    include: {
      pricingPlans: true,
    },
  });

  if (!representative) {
    throw new Error(`Representative "${representativeSlug}" not found. Run db:seed first.`);
  }

  const now = new Date();

  const contact = await prisma.contact.upsert({
    where: {
      representativeId_telegramUserId: {
        representativeId: representative.id,
        telegramUserId: String(actor.telegramUserId),
      },
    },
    create: {
      representativeId: representative.id,
      telegramUserId: String(actor.telegramUserId),
      username: actor.username ?? null,
      displayName: actor.displayName ?? actor.username ?? String(actor.telegramUserId),
      role: AudienceRole.OTHER,
      stage: ContactStage.NEW,
      isPaid: false,
      source: actor.channel.toLowerCase(),
      lastSeenAt: now,
    },
    update: {
      username: actor.username ?? null,
      displayName: actor.displayName ?? actor.username ?? String(actor.telegramUserId),
      source: actor.channel.toLowerCase(),
      lastSeenAt: now,
    },
  });

  const conversation = await prisma.conversation.upsert({
    where: {
      representativeId_telegramChatId_contactId: {
        representativeId: representative.id,
        telegramChatId: String(actor.chatId),
        contactId: contact.id,
      },
    },
    create: {
      representativeId: representative.id,
      contactId: contact.id,
      telegramChatId: String(actor.chatId),
      channel: actor.channel,
      state: "ACTIVE",
      freeRepliesUsed: 0,
      lastMessageAt: now,
    },
    update: {
      channel: actor.channel,
      lastMessageAt: now,
    },
  });

  return {
    representativeId: representative.id,
    representativeSlug: representative.slug,
    contactId: contact.id,
    conversationId: conversation.id,
    contactIsPaid: contact.isPaid,
    usage: {
      freeRepliesUsed: conversation.freeRepliesUsed,
      passUnlocked: Boolean(conversation.passUnlockedAt),
      deepHelpUnlocked: Boolean(conversation.deepHelpUnlockedAt),
    },
    collectorState: readStructuredCollectorState(conversation.collectorState),
    plans: representative.pricingPlans.reduce<ConversationContextRecord["plans"]>((acc, plan) => {
      acc[mapPricingPlanTypeFromDb(plan.type)] = {
        id: plan.id,
        tier: mapPricingPlanTypeFromDb(plan.type),
        name: plan.name,
        starsAmount: plan.starsAmount,
        includedReplies: plan.includedReplies,
        includesPriorityHandoff: plan.includesPriorityHandoff,
      };
      return acc;
    }, {}),
  };
}

export async function getActiveRepresentativeSlugForChat(
  telegramChatId: number | string,
): Promise<string | null> {
  const session = await prisma.chatSession.findUnique({
    where: {
      telegramChatId: String(telegramChatId),
    },
    include: {
      representative: {
        select: {
          slug: true,
        },
      },
    },
  });

  return session?.representative.slug ?? null;
}

export async function setActiveRepresentativeForChat(params: {
  telegramChatId: number | string;
  telegramUserId: number;
  representativeSlug: string;
}): Promise<string> {
  const representative = await prisma.representative.findUnique({
    where: { slug: params.representativeSlug },
    select: { id: true, slug: true },
  });

  if (!representative) {
    throw new Error(`Representative "${params.representativeSlug}" not found.`);
  }

  await prisma.chatSession.upsert({
    where: {
      telegramChatId: String(params.telegramChatId),
    },
    create: {
      telegramChatId: String(params.telegramChatId),
      telegramUserId: String(params.telegramUserId),
      representativeId: representative.id,
    },
    update: {
      telegramUserId: String(params.telegramUserId),
      representativeId: representative.id,
    },
  });

  return representative.slug;
}

export async function setStructuredCollectorState(params: {
  context: ConversationContextRecord;
  collectorState: StructuredCollectorState;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.conversation.update({
      where: { id: params.context.conversationId },
      data: {
        collectorState: params.collectorState,
        state: "COLLECTING",
      },
    });

    await tx.eventAudit.create({
      data: {
        representativeId: params.context.representativeId,
        contactId: params.context.contactId,
        conversationId: params.context.conversationId,
        type: EventType.INTAKE_STARTED,
        payload: {
          collectorKind: params.collectorState.kind,
          intent: params.collectorState.intent,
          stepIndex: params.collectorState.stepIndex,
        },
      },
    });
  });
}

export async function updateStructuredCollectorState(params: {
  context: ConversationContextRecord;
  collectorState: StructuredCollectorState;
}): Promise<void> {
  await prisma.conversation.update({
    where: { id: params.context.conversationId },
    data: {
      collectorState: params.collectorState,
      state: "COLLECTING",
    },
  });
}

export async function recordInboundTurn(params: {
  context: ConversationContextRecord;
  plan: ConversationPlan;
  text: string;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.conversationTurn.create({
      data: {
        conversationId: params.context.conversationId,
        direction: "inbound",
        messageText: params.text,
        intent: params.plan.intent,
        summary: params.plan.reasons.join(" "),
      },
    });

    await tx.eventAudit.create({
      data: {
        representativeId: params.context.representativeId,
        contactId: params.context.contactId,
        conversationId: params.context.conversationId,
        type: EventType.MESSAGE_RECEIVED,
        payload: {
          intent: params.plan.intent,
          nextStep: params.plan.nextStep,
        },
      },
    });
  });
}

export async function recordOutboundReply(params: {
  context: ConversationContextRecord;
  plan: ConversationPlan;
  messageText: string;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.conversationTurn.create({
      data: {
        conversationId: params.context.conversationId,
        direction: "outbound",
        messageText: params.messageText,
        intent: params.plan.intent,
        summary: params.plan.responseOutline.join(" "),
      },
    });

    await tx.eventAudit.create({
      data: {
        representativeId: params.context.representativeId,
        contactId: params.context.contactId,
        conversationId: params.context.conversationId,
        type: EventType.MESSAGE_ANSWERED,
        payload: {
          intent: params.plan.intent,
          nextStep: params.plan.nextStep,
          suggestedPlan: params.plan.suggestedPlan ?? null,
        },
      },
    });

    if (
      !params.context.usage.passUnlocked &&
      !params.context.usage.deepHelpUnlocked &&
      params.plan.nextStep !== "offer_paid_unlock"
    ) {
      await tx.conversation.update({
        where: { id: params.context.conversationId },
        data: {
          freeRepliesUsed: {
            increment: 1,
          },
        },
      });
    }
  });
}

export async function maybeCreateHandoffRequest(params: {
  context: ConversationContextRecord;
  plan: ConversationPlan;
  text: string;
}): Promise<{
  id: string;
  status: HandoffStatus;
} | null> {
  if (params.plan.nextStep !== "handoff" && params.plan.nextStep !== "ask_owner") {
    return null;
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.handoffRequest.findFirst({
      where: {
        representativeId: params.context.representativeId,
        contactId: params.context.contactId,
        conversationId: params.context.conversationId,
        reason: params.plan.intent,
        status: {
          in: [HandoffStatus.OPEN, HandoffStatus.REVIEWING],
        },
      },
      orderBy: [{ createdAt: "desc" }],
    });

    if (existing) {
      return {
        id: existing.id,
        status: existing.status,
      };
    }

    const intake = await tx.intakeSubmission.create({
      data: {
        representativeId: params.context.representativeId,
        contactId: params.context.contactId,
        conversationId: params.context.conversationId,
        requestType: params.plan.intent,
        payload: {
          text: params.text,
          audienceRole: params.plan.audienceRole,
          suggestedPlan: params.plan.suggestedPlan ?? null,
          reasons: params.plan.reasons,
        },
        priorityScore: calculatePriority(params.plan),
        recommendedNextStep: params.plan.nextStep === "ask_owner" ? "owner_approval" : "owner_review",
      },
    });

    const handoff = await tx.handoffRequest.create({
      data: {
        representativeId: params.context.representativeId,
        contactId: params.context.contactId,
        conversationId: params.context.conversationId,
        intakeSubmissionId: intake.id,
        reason: params.plan.intent,
        summary: summarizeText(params.text),
        recommendedPriority: calculatePriority(params.plan),
        recommendedOwnerAction: buildOwnerAction(params.plan),
        status: HandoffStatus.OPEN,
      },
    });

    await tx.contact.update({
      where: { id: params.context.contactId },
      data: {
        stage: ContactStage.WAITING_ON_OWNER,
      },
    });

    await tx.eventAudit.create({
      data: {
        representativeId: params.context.representativeId,
        contactId: params.context.contactId,
        conversationId: params.context.conversationId,
        type: EventType.HANDOFF_REQUESTED,
        payload: {
          handoffId: handoff.id,
          priority: handoff.recommendedPriority,
          intent: params.plan.intent,
        },
      },
    });

    return {
      id: handoff.id,
      status: handoff.status,
    };
  });
}

export async function clearStructuredCollectorState(context: ConversationContextRecord): Promise<void> {
  await prisma.conversation.update({
    where: { id: context.conversationId },
    data: {
      collectorState: Prisma.JsonNull,
      state: "ACTIVE",
    },
  });
}

export async function submitStructuredCollector(params: {
  context: ConversationContextRecord;
  collectorState: StructuredCollectorState;
}): Promise<{
  handoffId: string;
  summary: string;
  recommendedOwnerAction: string;
  priority: number;
}> {
  const summary = buildStructuredCollectorHandoffSummary(params.collectorState);
  const recommendedOwnerAction = buildStructuredCollectorOwnerAction(params.collectorState);
  const priority = calculateStructuredCollectorPriority(
    params.collectorState,
    params.context.contactIsPaid,
  );

  return prisma.$transaction(async (tx) => {
    const intake = await tx.intakeSubmission.create({
      data: {
        representativeId: params.context.representativeId,
        contactId: params.context.contactId,
        conversationId: params.context.conversationId,
        requestType: params.collectorState.intent,
        payload: {
          collectorKind: params.collectorState.kind,
          sourceChannel: params.collectorState.sourceChannel,
          suggestedPlan: params.collectorState.suggestedPlan ?? null,
          startedAt: params.collectorState.startedAt,
          completedAt: new Date().toISOString(),
          answers: params.collectorState.answers,
          summary: formatStructuredCollectorSummary(params.collectorState),
        },
        priorityScore: priority,
        recommendedNextStep:
          params.collectorState.kind === "scheduling"
            ? "owner_schedule_review"
            : "owner_quote_review",
      },
    });

    const existing = await tx.handoffRequest.findFirst({
      where: {
        representativeId: params.context.representativeId,
        contactId: params.context.contactId,
        conversationId: params.context.conversationId,
        reason: params.collectorState.intent,
        status: {
          in: [HandoffStatus.OPEN, HandoffStatus.REVIEWING],
        },
      },
      orderBy: [{ createdAt: "desc" }],
    });

    const handoff = existing
      ? await tx.handoffRequest.update({
          where: { id: existing.id },
          data: {
            intakeSubmissionId: intake.id,
            summary: summary || existing.summary,
            recommendedPriority: priority,
            recommendedOwnerAction,
          },
        })
      : await tx.handoffRequest.create({
          data: {
            representativeId: params.context.representativeId,
            contactId: params.context.contactId,
            conversationId: params.context.conversationId,
            intakeSubmissionId: intake.id,
            reason: params.collectorState.intent,
            summary: summary || "Structured intake completed.",
            recommendedPriority: priority,
            recommendedOwnerAction,
            status: HandoffStatus.OPEN,
          },
        });

    await tx.contact.update({
      where: { id: params.context.contactId },
      data: {
        stage: ContactStage.WAITING_ON_OWNER,
      },
    });

    await tx.conversation.update({
      where: { id: params.context.conversationId },
      data: {
        collectorState: Prisma.JsonNull,
        state: "ACTIVE",
      },
    });

    await tx.eventAudit.create({
      data: {
        representativeId: params.context.representativeId,
        contactId: params.context.contactId,
        conversationId: params.context.conversationId,
        type: EventType.INTAKE_SUBMITTED,
        payload: {
          intakeSubmissionId: intake.id,
          handoffId: handoff.id,
          collectorKind: params.collectorState.kind,
          summary,
          priority,
        },
      },
    });

    if (!existing) {
      await tx.eventAudit.create({
        data: {
          representativeId: params.context.representativeId,
          contactId: params.context.contactId,
          conversationId: params.context.conversationId,
          type: EventType.HANDOFF_REQUESTED,
          payload: {
            handoffId: handoff.id,
            priority,
            intent: params.collectorState.intent,
          },
        },
      });
    }

    return {
      handoffId: handoff.id,
      summary: summary || "Structured intake completed.",
      recommendedOwnerAction,
      priority,
    };
  });
}

export async function createPlanInvoice(params: {
  context: ConversationContextRecord;
  tier: PlanTier;
}): Promise<{
  invoiceId: string;
  payload: string;
  title: string;
  starsAmount: number;
}> {
  const plan = params.context.plans[params.tier];
  if (!plan) {
    throw new Error(`Plan "${params.tier}" is not configured for this representative.`);
  }

  const invoiceId = `${params.context.conversationId}_${plan.tier}_${Date.now()}`;
  const payload = buildInvoicePayload(invoiceId);

  const invoice = await prisma.invoice.create({
    data: {
      id: invoiceId,
      representativeId: params.context.representativeId,
      contactId: params.context.contactId,
      conversationId: params.context.conversationId,
      planType: mapPricingPlanTypeToDb(plan.tier),
      title: plan.name,
      payload,
      starsAmount: plan.starsAmount,
      status: InvoiceStatus.PENDING,
    },
  });

  await prisma.eventAudit.create({
    data: {
      representativeId: params.context.representativeId,
      contactId: params.context.contactId,
      conversationId: params.context.conversationId,
      type: EventType.PAYMENT_INVOICE_CREATED,
      payload: {
        invoiceId: invoice.id,
        planType: plan.tier,
        starsAmount: plan.starsAmount,
      },
    },
  });

  return {
    invoiceId: invoice.id,
    payload: invoice.payload,
    title: invoice.title,
    starsAmount: invoice.starsAmount,
  };
}

export async function markInvoiceDeliveryFailed(invoiceId: string): Promise<void> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
  });

  if (!invoice || invoice.status !== InvoiceStatus.PENDING) {
    return;
  }

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      status: InvoiceStatus.FAILED,
    },
  });
}

export async function validatePendingInvoice(payload: string, telegramUserId: number): Promise<void> {
  const invoice = await prisma.invoice.findUnique({
    where: { payload },
    include: {
      contact: true,
    },
  });

  if (!invoice) {
    throw new Error("Unknown payment payload.");
  }

  if (invoice.status !== InvoiceStatus.PENDING) {
    throw new Error("This invoice is no longer payable.");
  }

  if (invoice.contact.telegramUserId !== String(telegramUserId)) {
    throw new Error("Invoice owner mismatch.");
  }
}

export async function confirmInvoicePayment(
  params: SuccessfulPaymentInput,
): Promise<{
  planName: string;
  starsAmount: number;
  representativeSlug: string;
}> {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({
      where: { payload: params.invoicePayload },
      include: {
        representative: {
          include: {
            owner: {
              include: {
                wallet: true,
              },
            },
          },
        },
        contact: true,
        conversation: true,
      },
    });

    if (!invoice) {
      throw new Error("Unknown payment payload.");
    }

    if (invoice.status === InvoiceStatus.PAID || invoice.status === InvoiceStatus.FULFILLED) {
      return {
        planName: invoice.title,
        starsAmount: invoice.starsAmount,
        representativeSlug: invoice.representative.slug,
      };
    }

    const paidAt = new Date();

    await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        status: invoice.planType === PricingPlanType.SPONSOR ? InvoiceStatus.FULFILLED : InvoiceStatus.PAID,
        paidAt,
        telegramPaymentChargeId: params.telegramPaymentChargeId,
        providerPaymentChargeId: params.providerPaymentChargeId ?? null,
      },
    });

    if (invoice.representative.owner.wallet) {
      await tx.wallet.update({
        where: { ownerId: invoice.representative.owner.id },
        data: {
          starsBalance: {
            increment: params.totalAmount,
          },
          ...(invoice.planType === PricingPlanType.SPONSOR
            ? {
                sponsorPoolCredit: {
                  increment: params.totalAmount,
                },
              }
            : {}),
        },
      });
    } else {
      await tx.wallet.create({
        data: {
          ownerId: invoice.representative.owner.id,
          starsBalance: params.totalAmount,
          sponsorPoolCredit: invoice.planType === PricingPlanType.SPONSOR ? params.totalAmount : 0,
          balanceCredits: 0,
        },
      });
    }

    await tx.contact.update({
      where: {
        representativeId_telegramUserId: {
          representativeId: invoice.representativeId,
          telegramUserId: invoice.contact.telegramUserId,
        },
      },
      data: {
        isPaid: true,
        stage:
          invoice.planType === PricingPlanType.DEEP_HELP
            ? ContactStage.WAITING_ON_OWNER
            : ContactStage.QUALIFIED,
      },
    });

    if (invoice.conversationId) {
      await tx.conversation.update({
        where: { id: invoice.conversationId },
        data: {
          ...(invoice.planType === PricingPlanType.PASS
            ? { passUnlockedAt: paidAt }
            : {}),
          ...(invoice.planType === PricingPlanType.DEEP_HELP
            ? { deepHelpUnlockedAt: paidAt }
            : {}),
        },
      });
    }

    await tx.eventAudit.create({
      data: {
        representativeId: invoice.representativeId,
        contactId: invoice.contactId,
        conversationId: invoice.conversationId,
        type: EventType.PAYMENT_CONFIRMED,
        payload: {
          invoiceId: invoice.id,
          amount: params.totalAmount,
          status:
            invoice.planType === PricingPlanType.SPONSOR ? InvoiceStatus.FULFILLED : InvoiceStatus.PAID,
        },
      },
    });

    return {
      planName: invoice.title,
      starsAmount: invoice.starsAmount,
      representativeSlug: invoice.representative.slug,
    };
  });
}

export function buildInvoicePayload(invoiceId: string): string {
  return `delegate:invoice:${invoiceId}`;
}

function buildOwnerAction(plan: ConversationPlan): string {
  switch (plan.intent) {
    case "refund":
      return "Approve or decline refund before sending a human response.";
    case "media":
      return "Confirm whether the founder wants to take this media request.";
    case "scheduling":
      return "Confirm whether to expose a candidate time window.";
    case "pricing":
    case "collaboration":
      return "Review context, budget, and decide whether to take the lead personally.";
    default:
      return "Review the request and decide whether the owner should step in.";
  }
}

function calculatePriority(plan: ConversationPlan): number {
  if (plan.intent === "refund") {
    return 95;
  }
  if (plan.suggestedPlan === "deep_help") {
    return 88;
  }
  if (plan.intent === "media") {
    return 68;
  }
  return 78;
}

function summarizeText(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > 180 ? `${normalized.slice(0, 177)}...` : normalized;
}

function mapPricingPlanTypeFromDb(value: PricingPlanType): PlanTier {
  switch (value) {
    case PricingPlanType.PASS:
      return "pass";
    case PricingPlanType.DEEP_HELP:
      return "deep_help";
    case PricingPlanType.SPONSOR:
      return "sponsor";
    case PricingPlanType.FREE:
    default:
      return "free";
  }
}

function mapPricingPlanTypeToDb(value: PlanTier): PricingPlanType {
  switch (value) {
    case "pass":
      return PricingPlanType.PASS;
    case "deep_help":
      return PricingPlanType.DEEP_HELP;
    case "sponsor":
      return PricingPlanType.SPONSOR;
    case "free":
    default:
      return PricingPlanType.FREE;
  }
}
