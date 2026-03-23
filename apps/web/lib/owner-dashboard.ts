import { demoRepresentative } from "@delegate/domain";
import {
  HandoffStatus,
  InvoiceStatus,
  PricingPlanType,
  Prisma,
} from "@prisma/client";

import { prisma } from "./prisma";

export type DashboardOverviewSnapshot = {
  representative: {
    slug: string;
    displayName: string;
    roleSummary: string;
  };
  metrics: Array<{
    label: string;
    value: string;
    detail: string;
  }>;
  wallet: {
    starsBalance: number;
    sponsorPoolCredit: number;
    balanceCredits: number;
  };
  handoffRequests: Array<{
    id: string;
    who: string;
    why: string;
    score: "High" | "Medium" | "Low";
    status: "open" | "reviewing" | "accepted" | "declined" | "closed";
    recommendedOwnerAction: string;
    requestType: string;
    isPaid: boolean;
    requestedAt: string;
  }>;
  recentInvoices: Array<{
    id: string;
    who: string;
    planName: string;
    planType: "free" | "pass" | "deep_help" | "sponsor";
    starsAmount: number;
    status: "pending" | "paid" | "fulfilled" | "refunded" | "failed" | "canceled";
    createdAt: string;
    paidAt?: string;
    invoiceLink?: string;
  }>;
};

const overviewArgs = Prisma.validator<Prisma.RepresentativeDefaultArgs>()({
  include: {
    owner: {
      include: {
        wallet: true,
      },
    },
    handoffRequests: {
      include: {
        contact: true,
      },
      orderBy: [{ recommendedPriority: "desc" }, { createdAt: "desc" }],
      take: 8,
    },
    invoices: {
      include: {
        contact: true,
      },
      orderBy: [{ createdAt: "desc" }],
      take: 8,
    },
  },
});

type RepresentativeOverviewRecord = Prisma.RepresentativeGetPayload<{
  include: typeof overviewArgs.include;
}>;

let demoFallbackOverviewSnapshot: DashboardOverviewSnapshot | null = null;

export async function getDashboardOverviewSnapshot(
  representativeSlug: string,
): Promise<DashboardOverviewSnapshot | null> {
  if (shouldUseStaticFallbackMode(representativeSlug)) {
    return cloneDashboardOverviewSnapshot(getOrCreateDemoFallbackOverviewSnapshot());
  }

  try {
    const representative = await prisma.representative.findUnique({
      where: { slug: representativeSlug },
      ...overviewArgs,
    });

    if (!representative) {
      return null;
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [todayConversationCount, openHandoffCount, paidInvoiceCount] = await prisma.$transaction([
      prisma.conversation.count({
        where: {
          representativeId: representative.id,
          createdAt: {
            gte: startOfToday,
          },
        },
      }),
      prisma.handoffRequest.count({
        where: {
          representativeId: representative.id,
          status: {
            in: [HandoffStatus.OPEN, HandoffStatus.REVIEWING],
          },
        },
      }),
      prisma.invoice.count({
        where: {
          representativeId: representative.id,
          status: {
            in: [InvoiceStatus.PAID, InvoiceStatus.FULFILLED],
          },
        },
      }),
    ]);

    const wallet = representative.owner.wallet;
    const paidBreakdown = buildPaidBreakdown(representative.invoices);

    return {
      representative: {
        slug: representative.slug,
        displayName: representative.displayName,
        roleSummary: representative.roleSummary,
      },
      metrics: [
        {
          label: "今日新会话",
          value: String(todayConversationCount),
          detail: todayConversationCount > 0 ? "已进入真实会话表统计" : "今天还没有新的 inbound 会话",
        },
        {
          label: "已确认付费",
          value: String(paidInvoiceCount),
          detail: paidBreakdown || "还没有完成的 Stars 付费记录",
        },
        {
          label: "待人工评估",
          value: String(openHandoffCount),
          detail:
            openHandoffCount > 0
              ? "包含 open 与 reviewing 状态的收件项"
              : "当前 owner inbox 已清空",
        },
        {
          label: "Stars 余额",
          value: wallet ? String(wallet.starsBalance) : "0",
          detail: wallet
            ? `sponsor pool ${wallet.sponsorPoolCredit} · credits ${wallet.balanceCredits}`
            : "还没有 owner wallet 记录",
        },
      ],
      wallet: {
        starsBalance: wallet?.starsBalance ?? 0,
        sponsorPoolCredit: wallet?.sponsorPoolCredit ?? 0,
        balanceCredits: wallet?.balanceCredits ?? 0,
      },
      handoffRequests: representative.handoffRequests.map((handoff) => ({
        id: handoff.id,
        who: handoff.contact.displayName ?? handoff.contact.username ?? handoff.contact.telegramUserId,
        why: handoff.summary,
        score: mapPriorityToLabel(handoff.recommendedPriority),
        status: normalizeHandoffStatus(handoff.status),
        recommendedOwnerAction: handoff.recommendedOwnerAction,
        requestType: handoff.reason,
        isPaid: handoff.contact.isPaid,
        requestedAt: handoff.createdAt.toISOString(),
      })),
      recentInvoices: representative.invoices.map((invoice) => ({
        id: invoice.id,
        who: invoice.contact.displayName ?? invoice.contact.username ?? invoice.contact.telegramUserId,
        planName: invoice.title,
        planType: mapPricingPlanTypeFromDb(invoice.planType),
        starsAmount: invoice.starsAmount,
        status: mapInvoiceStatus(invoice.status),
        createdAt: invoice.createdAt.toISOString(),
        ...(invoice.paidAt ? { paidAt: invoice.paidAt.toISOString() } : {}),
        ...(invoice.invoiceLink ? { invoiceLink: invoice.invoiceLink } : {}),
      })),
    };
  } catch (error) {
    if (shouldUseDemoFallback(error, representativeSlug)) {
      return cloneDashboardOverviewSnapshot(getOrCreateDemoFallbackOverviewSnapshot());
    }
    throw error;
  }
}

export async function setHandoffRequestStatus(params: {
  representativeSlug: string;
  handoffId: string;
  status: "open" | "reviewing" | "accepted" | "declined" | "closed";
}): Promise<DashboardOverviewSnapshot["handoffRequests"][number]> {
  if (shouldUseStaticFallbackMode(params.representativeSlug)) {
    return setDemoFallbackHandoffStatus(params.handoffId, params.status);
  }

  try {
    const handoff = await prisma.handoffRequest.findFirst({
      where: {
        id: params.handoffId,
        representative: {
          slug: params.representativeSlug,
        },
      },
      include: {
        contact: true,
      },
    });

    if (!handoff) {
      throw new Error("Handoff request not found.");
    }

    const updated = await prisma.handoffRequest.update({
      where: { id: handoff.id },
      data: {
        status: mapHandoffStatusToDb(params.status),
      },
      include: {
        contact: true,
      },
    });

    return {
      id: updated.id,
      who: updated.contact.displayName ?? updated.contact.username ?? updated.contact.telegramUserId,
      why: updated.summary,
      score: mapPriorityToLabel(updated.recommendedPriority),
      status: normalizeHandoffStatus(updated.status),
      recommendedOwnerAction: updated.recommendedOwnerAction,
      requestType: updated.reason,
      isPaid: updated.contact.isPaid,
      requestedAt: updated.createdAt.toISOString(),
    };
  } catch (error) {
    if (shouldUseDemoFallback(error, params.representativeSlug)) {
      return setDemoFallbackHandoffStatus(params.handoffId, params.status);
    }
    throw error;
  }
}

function getOrCreateDemoFallbackOverviewSnapshot(): DashboardOverviewSnapshot {
  if (!demoFallbackOverviewSnapshot) {
    const now = new Date();
    const hoursAgo = (value: number) => new Date(now.getTime() - value * 60 * 60 * 1000).toISOString();

    demoFallbackOverviewSnapshot = {
      representative: {
        slug: demoRepresentative.slug,
        displayName: demoRepresentative.name,
        roleSummary: demoRepresentative.tagline,
      },
      metrics: [
        { label: "今日新会话", value: "4", detail: "1 个来自群组 mention，3 个来自私聊" },
        { label: "已确认付费", value: "3", detail: "1 Pass，1 Deep Help，1 Sponsor" },
        { label: "待人工评估", value: "3", detail: "2 个合作，1 个退款" },
        { label: "Stars 余额", value: "2060", detail: "sponsor pool 1200 · credits 240" },
      ],
      wallet: {
        starsBalance: 2060,
        sponsorPoolCredit: 1200,
        balanceCredits: 240,
      },
      handoffRequests: [
        {
          id: "demo-handoff-acme",
          who: "Acme AI",
          why: "想谈一周内启动的自动化合作，预算已说明。",
          score: "High",
          status: "open",
          recommendedOwnerAction: "Review budget and decide whether to accept a founder call.",
          requestType: "collaboration",
          isPaid: true,
          requestedAt: hoursAgo(2),
        },
        {
          id: "demo-handoff-creator",
          who: "Creator Podcast",
          why: "媒体采访请求，需要 founder 本人确认档期。",
          score: "Medium",
          status: "reviewing",
          recommendedOwnerAction: "Confirm availability for a podcast recording slot.",
          requestType: "media",
          isPaid: false,
          requestedAt: hoursAgo(5),
        },
        {
          id: "demo-handoff-refund",
          who: "匿名用户",
          why: "要求退款，触发 ask-first 规则。",
          score: "High",
          status: "open",
          recommendedOwnerAction: "Approve or decline refund before sending a human response.",
          requestType: "refund",
          isPaid: true,
          requestedAt: hoursAgo(6),
        },
      ],
      recentInvoices: [
        {
          id: "demo-invoice-pass",
          who: "Acme AI",
          planName: "Pass",
          planType: "pass",
          starsAmount: 180,
          status: "paid",
          createdAt: hoursAgo(13),
          paidAt: hoursAgo(12),
          invoiceLink: "https://t.me/invoice/acme-pass",
        },
        {
          id: "demo-invoice-deep-help",
          who: "匿名用户",
          planName: "Deep Help",
          planType: "deep_help",
          starsAmount: 680,
          status: "paid",
          createdAt: hoursAgo(21),
          paidAt: hoursAgo(20),
          invoiceLink: "https://t.me/invoice/refund-deep-help",
        },
        {
          id: "demo-invoice-sponsor",
          who: "Community Angel",
          planName: "Sponsor",
          planType: "sponsor",
          starsAmount: 1200,
          status: "fulfilled",
          createdAt: hoursAgo(2),
          paidAt: hoursAgo(1),
          invoiceLink: "https://t.me/invoice/sponsor-pool",
        },
      ],
    };
  }

  return demoFallbackOverviewSnapshot;
}

function setDemoFallbackHandoffStatus(
  handoffId: string,
  status: DashboardOverviewSnapshot["handoffRequests"][number]["status"],
): DashboardOverviewSnapshot["handoffRequests"][number] {
  const snapshot = getOrCreateDemoFallbackOverviewSnapshot();
  const handoff = snapshot.handoffRequests.find((entry) => entry.id === handoffId);

  if (!handoff) {
    throw new Error("Handoff request not found.");
  }

  handoff.status = status;
  return { ...handoff };
}

function cloneDashboardOverviewSnapshot(
  snapshot: DashboardOverviewSnapshot,
): DashboardOverviewSnapshot {
  return {
    representative: { ...snapshot.representative },
    metrics: snapshot.metrics.map((metric) => ({ ...metric })),
    wallet: { ...snapshot.wallet },
    handoffRequests: snapshot.handoffRequests.map((request) => ({ ...request })),
    recentInvoices: snapshot.recentInvoices.map((invoice) => ({ ...invoice })),
  };
}

function buildPaidBreakdown(
  invoices: RepresentativeOverviewRecord["invoices"],
): string {
  const relevant = invoices.filter((invoice) =>
    invoice.status === InvoiceStatus.PAID || invoice.status === InvoiceStatus.FULFILLED,
  );

  if (relevant.length === 0) {
    return "";
  }

  const counts = new Map<PricingPlanType, number>();
  for (const invoice of relevant) {
    counts.set(invoice.planType, (counts.get(invoice.planType) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([planType, count]) => `${count} ${mapPricingPlanTypeFromDb(planType)}`)
    .join("，");
}

function mapPriorityToLabel(value: number): "High" | "Medium" | "Low" {
  if (value >= 85) {
    return "High";
  }
  if (value >= 60) {
    return "Medium";
  }
  return "Low";
}

function normalizeHandoffStatus(
  value: HandoffStatus,
): DashboardOverviewSnapshot["handoffRequests"][number]["status"] {
  switch (value) {
    case HandoffStatus.REVIEWING:
      return "reviewing";
    case HandoffStatus.ACCEPTED:
      return "accepted";
    case HandoffStatus.DECLINED:
      return "declined";
    case HandoffStatus.CLOSED:
      return "closed";
    case HandoffStatus.OPEN:
    default:
      return "open";
  }
}

function mapHandoffStatusToDb(
  value: DashboardOverviewSnapshot["handoffRequests"][number]["status"],
): HandoffStatus {
  switch (value) {
    case "reviewing":
      return HandoffStatus.REVIEWING;
    case "accepted":
      return HandoffStatus.ACCEPTED;
    case "declined":
      return HandoffStatus.DECLINED;
    case "closed":
      return HandoffStatus.CLOSED;
    case "open":
    default:
      return HandoffStatus.OPEN;
  }
}

function mapPricingPlanTypeFromDb(
  value: PricingPlanType,
): DashboardOverviewSnapshot["recentInvoices"][number]["planType"] {
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

function mapInvoiceStatus(
  value: InvoiceStatus,
): DashboardOverviewSnapshot["recentInvoices"][number]["status"] {
  switch (value) {
    case InvoiceStatus.PAID:
      return "paid";
    case InvoiceStatus.FULFILLED:
      return "fulfilled";
    case InvoiceStatus.REFUNDED:
      return "refunded";
    case InvoiceStatus.FAILED:
      return "failed";
    case InvoiceStatus.CANCELED:
      return "canceled";
    case InvoiceStatus.PENDING:
    default:
      return "pending";
  }
}

function shouldUseDemoFallback(error: unknown, representativeSlug: string): boolean {
  return representativeSlug === demoRepresentative.slug && isPrismaUnavailableError(error);
}

function shouldUseStaticFallbackMode(representativeSlug: string): boolean {
  return representativeSlug === demoRepresentative.slug && !process.env.DATABASE_URL?.trim();
}

function isPrismaUnavailableError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes("Can't reach database server") ||
    error.message.includes("Environment variable not found: DATABASE_URL") ||
    error.message.includes("P1001")
  );
}
