import {
  demoRepresentative,
  type GroupActivation as DomainGroupActivation,
  type SkillPack as DomainSkillPack,
} from "@delegate/domain";
import { fetchClawHubRepresentativeSkill } from "@delegate/registry";
import {
  GroupActivation,
  PricingPlanType,
  SkillPackSource,
  type Prisma,
} from "@prisma/client";

import { prisma } from "./prisma";

export type DashboardRepresentativeSkillPack = DomainSkillPack & {
  linkId: string;
  installedAt?: string;
};

export type RepresentativeSkillPackSnapshot = {
  representative: {
    slug: string;
    displayName: string;
    roleSummary: string;
    groupActivation: DomainGroupActivation;
    humanInLoop: boolean;
    publicMode: boolean;
  };
  skillPacks: DashboardRepresentativeSkillPack[];
};

const DEMO_OWNER_TELEGRAM_ID = "demo-owner-lin";
const linkedSkillPackInclude = {
  skillPack: true,
} as const;
let demoFallbackSnapshot: RepresentativeSkillPackSnapshot | null = null;

type RepresentativeSkillPackWithSkillPack = Prisma.RepresentativeSkillPackGetPayload<{
  include: typeof linkedSkillPackInclude;
}>;

type PersistableSkillPack = Pick<
  DomainSkillPack,
  | "displayName"
  | "summary"
  | "version"
  | "sourceUrl"
  | "ownerHandle"
  | "verificationTier"
  | "capabilityTags"
  | "executesCode"
>;

export async function getRepresentativeSkillPackSnapshot(
  representativeSlug: string,
): Promise<RepresentativeSkillPackSnapshot | null> {
  try {
    await ensureRepresentativeSeeded(representativeSlug);

    const representative = await prisma.representative.findUnique({
      where: { slug: representativeSlug },
      include: {
        skillPackLinks: {
          include: linkedSkillPackInclude,
          orderBy: [{ createdAt: "asc" }],
        },
      },
    });

    if (!representative) {
      return null;
    }

    return {
      representative: {
        slug: representative.slug,
        displayName: representative.displayName,
        roleSummary: representative.roleSummary,
        groupActivation: mapGroupActivationFromDb(representative.groupActivation),
        humanInLoop: representative.humanInLoop,
        publicMode: representative.publicMode,
      },
      skillPacks: representative.skillPackLinks.map((link) => serializeLinkedSkillPack(link)),
    };
  } catch (error) {
    if (shouldUseDemoFallback(error, representativeSlug)) {
      return cloneRepresentativeSnapshot(getOrCreateDemoFallbackSnapshot());
    }
    throw error;
  }
}

export async function installClawHubSkillPackForRepresentative(params: {
  representativeSlug: string;
  skillPackSlug: string;
}): Promise<DashboardRepresentativeSkillPack> {
  const discovered = await fetchClawHubRepresentativeSkill({
    slug: params.skillPackSlug,
  });
  if (!discovered) {
    throw new Error(`ClawHub skill "${params.skillPackSlug}" was not found.`);
  }

  try {
    await ensureRepresentativeSeeded(params.representativeSlug);

    const representative = await prisma.representative.findUnique({
      where: { slug: params.representativeSlug },
    });
    if (!representative) {
      throw new Error(`Representative "${params.representativeSlug}" not found.`);
    }

    const now = new Date();
    const persistedDiscoveredSkillPack = buildPersistedSkillPackFields(discovered);

    const link = await prisma.$transaction(async (tx) => {
      const skillPack = await tx.skillPack.upsert({
        where: {
          source_slug: {
            source: SkillPackSource.CLAWHUB,
            slug: discovered.slug,
          },
        },
        create: {
          source: SkillPackSource.CLAWHUB,
          slug: discovered.slug,
          ...persistedDiscoveredSkillPack,
        },
        update: persistedDiscoveredSkillPack,
      });

      const existing = await tx.representativeSkillPack.findUnique({
        where: {
          representativeId_skillPackId: {
            representativeId: representative.id,
            skillPackId: skillPack.id,
          },
        },
        include: linkedSkillPackInclude,
      });

      if (existing) {
        return tx.representativeSkillPack.update({
          where: { id: existing.id },
          data: {
            installStatus: "installed",
            installedVersion: discovered.version ?? existing.installedVersion ?? null,
            installedAt: existing.installedAt ?? now,
          },
          include: linkedSkillPackInclude,
        });
      }

      return tx.representativeSkillPack.create({
        data: {
          representativeId: representative.id,
          skillPackId: skillPack.id,
          enabled: false,
          installStatus: "installed",
          installedVersion: discovered.version ?? null,
          installedAt: now,
        },
        include: linkedSkillPackInclude,
      });
    });

    return serializeLinkedSkillPack(link);
  } catch (error) {
    if (shouldUseDemoFallback(error, params.representativeSlug)) {
      return installClawHubSkillPackInDemoFallback(discovered);
    }
    throw error;
  }
}

export async function setRepresentativeSkillPackEnabled(params: {
  representativeSlug: string;
  linkId: string;
  enabled: boolean;
}): Promise<DashboardRepresentativeSkillPack> {
  try {
    await ensureRepresentativeSeeded(params.representativeSlug);

    const link = await prisma.representativeSkillPack.findFirst({
      where: {
        id: params.linkId,
        representative: {
          slug: params.representativeSlug,
        },
      },
      include: linkedSkillPackInclude,
    });

    if (!link) {
      throw new Error("Representative skill pack link not found.");
    }

    const updated = await prisma.representativeSkillPack.update({
      where: { id: link.id },
      data: {
        enabled: params.enabled,
        installStatus: link.installStatus === "available" ? "installed" : link.installStatus,
        installedAt: link.installedAt ?? new Date(),
        installedVersion: link.installedVersion ?? link.skillPack.version ?? null,
      },
      include: linkedSkillPackInclude,
    });

    return serializeLinkedSkillPack(updated);
  } catch (error) {
    if (shouldUseDemoFallback(error, params.representativeSlug)) {
      return setDemoFallbackSkillPackEnabled(params.linkId, params.enabled);
    }
    throw error;
  }
}

async function ensureRepresentativeSeeded(representativeSlug: string): Promise<void> {
  if (representativeSlug !== demoRepresentative.slug) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    const owner = await tx.owner.upsert({
      where: { telegramUserId: DEMO_OWNER_TELEGRAM_ID },
      create: {
        telegramUserId: DEMO_OWNER_TELEGRAM_ID,
        displayName: demoRepresentative.ownerName,
        handle: "lin",
        timezone: "Asia/Shanghai",
      },
      update: {
        displayName: demoRepresentative.ownerName,
        handle: "lin",
        timezone: "Asia/Shanghai",
      },
    });

    const representative = await tx.representative.upsert({
      where: { slug: demoRepresentative.slug },
      create: {
        ownerId: owner.id,
        slug: demoRepresentative.slug,
        displayName: demoRepresentative.name,
        roleSummary: demoRepresentative.tagline,
        tone: demoRepresentative.tone,
        publicMode: true,
        groupModeEnabled: true,
        groupActivation: mapGroupActivationToDb(demoRepresentative.groupActivation),
        humanInLoop: true,
        freeReplyLimit: demoRepresentative.contract.freeReplyLimit,
        freeMonthlyCredit: 100,
        allowedSkills: demoRepresentative.skills,
        actionGate: demoRepresentative.actionGate,
      },
      update: {
        ownerId: owner.id,
        displayName: demoRepresentative.name,
        roleSummary: demoRepresentative.tagline,
        tone: demoRepresentative.tone,
        groupActivation: mapGroupActivationToDb(demoRepresentative.groupActivation),
        allowedSkills: demoRepresentative.skills,
        actionGate: demoRepresentative.actionGate,
      },
    });

    const existingKnowledgePack = await tx.knowledgePack.findUnique({
      where: { representativeId: representative.id },
    });
    if (!existingKnowledgePack) {
      await tx.knowledgePack.create({
        data: {
          representativeId: representative.id,
          identitySummary: demoRepresentative.knowledgePack.identitySummary,
          faq: demoRepresentative.knowledgePack.faq,
          materials: demoRepresentative.knowledgePack.materials,
          policies: demoRepresentative.knowledgePack.policies,
        },
      });
    }

    const pricingPlanCount = await tx.pricingPlan.count({
      where: { representativeId: representative.id },
    });
    if (pricingPlanCount === 0) {
      await tx.pricingPlan.createMany({
        data: demoRepresentative.pricing.map((plan) => ({
          representativeId: representative.id,
          type: mapPricingPlanType(plan.tier),
          name: plan.name,
          starsAmount: plan.stars,
          summary: plan.summary,
          includedReplies: plan.includedReplies,
          includesPriorityHandoff: plan.includesPriorityHandoff,
        })),
      });
    }

    for (const pack of demoRepresentative.skillPacks) {
      const persistedSkillPack = buildPersistedSkillPackFields(pack);
      const skillPack = await tx.skillPack.upsert({
        where: {
          source_slug: {
            source: mapSkillPackSourceToDb(pack.source),
            slug: pack.slug,
          },
        },
        create: {
          source: mapSkillPackSourceToDb(pack.source),
          slug: pack.slug,
          ...persistedSkillPack,
        },
        update: persistedSkillPack,
      });

      const existingLink = await tx.representativeSkillPack.findUnique({
        where: {
          representativeId_skillPackId: {
            representativeId: representative.id,
            skillPackId: skillPack.id,
          },
        },
      });

      if (!existingLink) {
        await tx.representativeSkillPack.create({
          data: {
            representativeId: representative.id,
            skillPackId: skillPack.id,
            enabled: pack.enabled,
            installStatus: pack.installStatus,
            installedVersion: pack.version ?? null,
            installedAt: pack.installStatus === "available" ? null : new Date(),
          },
        });
      }
    }
  });
}

function serializeLinkedSkillPack(
  link: RepresentativeSkillPackWithSkillPack,
): DashboardRepresentativeSkillPack {
  return {
    linkId: link.id,
    id: link.skillPack.id,
    slug: link.skillPack.slug,
    displayName: link.skillPack.displayName,
    source: mapSkillPackSourceFromDb(link.skillPack.source),
    summary: link.skillPack.summary,
    ...(link.skillPack.version ? { version: link.skillPack.version } : {}),
    ...(link.skillPack.sourceUrl ? { sourceUrl: link.skillPack.sourceUrl } : {}),
    ...(link.skillPack.ownerHandle ? { ownerHandle: link.skillPack.ownerHandle } : {}),
    ...(link.skillPack.verificationTier
      ? { verificationTier: link.skillPack.verificationTier }
      : {}),
    capabilityTags: parseCapabilityTags(link.skillPack.capabilityTags),
    executesCode: link.skillPack.executesCode,
    enabled: link.enabled,
    installStatus: normalizeInstallStatus(link.installStatus),
    ...(link.installedVersion ? { version: link.installedVersion } : {}),
    ...(link.installedAt ? { installedAt: link.installedAt.toISOString() } : {}),
  };
}

function buildPersistedSkillPackFields(
  pack: PersistableSkillPack,
): Pick<
  Prisma.SkillPackUncheckedCreateInput,
  | "displayName"
  | "summary"
  | "version"
  | "sourceUrl"
  | "ownerHandle"
  | "verificationTier"
  | "capabilityTags"
  | "executesCode"
> {
  return {
    displayName: pack.displayName,
    summary: pack.summary,
    version: pack.version ?? null,
    sourceUrl: pack.sourceUrl ?? null,
    ownerHandle: pack.ownerHandle ?? null,
    verificationTier: pack.verificationTier ?? null,
    capabilityTags: pack.capabilityTags,
    executesCode: pack.executesCode,
  };
}

function getOrCreateDemoFallbackSnapshot(): RepresentativeSkillPackSnapshot {
  if (!demoFallbackSnapshot) {
    demoFallbackSnapshot = {
      representative: {
        slug: demoRepresentative.slug,
        displayName: demoRepresentative.name,
        roleSummary: demoRepresentative.tagline,
        groupActivation: demoRepresentative.groupActivation,
        humanInLoop: true,
        publicMode: true,
      },
      skillPacks: demoRepresentative.skillPacks.map((pack, index) => ({
        linkId: buildDemoFallbackLinkId(pack.slug, index),
        ...pack,
        ...(pack.installStatus === "available" ? {} : { installedAt: new Date().toISOString() }),
      })),
    };
  }

  return demoFallbackSnapshot;
}

function installClawHubSkillPackInDemoFallback(
  discovered: DomainSkillPack,
): DashboardRepresentativeSkillPack {
  const state = getOrCreateDemoFallbackSnapshot();
  const existing = state.skillPacks.find(
    (skillPack) =>
      skillPack.source === discovered.source && skillPack.slug === discovered.slug,
  );
  const installedAt = new Date().toISOString();

  if (existing) {
    existing.displayName = discovered.displayName;
    existing.summary = discovered.summary;
    existing.version = discovered.version;
    existing.sourceUrl = discovered.sourceUrl;
    existing.ownerHandle = discovered.ownerHandle;
    existing.verificationTier = discovered.verificationTier;
    existing.capabilityTags = [...discovered.capabilityTags];
    existing.executesCode = discovered.executesCode;
    existing.installStatus = "installed";
    existing.installedAt = existing.installedAt ?? installedAt;
    return cloneDashboardSkillPack(existing);
  }

  const installed: DashboardRepresentativeSkillPack = {
    linkId: buildDemoFallbackLinkId(discovered.slug, state.skillPacks.length),
    ...discovered,
    enabled: false,
    installStatus: "installed",
    installedAt,
  };

  state.skillPacks.push(installed);
  return cloneDashboardSkillPack(installed);
}

function setDemoFallbackSkillPackEnabled(
  linkId: string,
  enabled: boolean,
): DashboardRepresentativeSkillPack {
  const state = getOrCreateDemoFallbackSnapshot();
  const skillPack = state.skillPacks.find((entry) => entry.linkId === linkId);

  if (!skillPack) {
    throw new Error("Representative skill pack link not found.");
  }

  skillPack.enabled = enabled;
  skillPack.installStatus =
    skillPack.installStatus === "available" ? "installed" : skillPack.installStatus;
  skillPack.installedAt = skillPack.installedAt ?? new Date().toISOString();

  return cloneDashboardSkillPack(skillPack);
}

function cloneRepresentativeSnapshot(
  snapshot: RepresentativeSkillPackSnapshot,
): RepresentativeSkillPackSnapshot {
  return {
    representative: { ...snapshot.representative },
    skillPacks: snapshot.skillPacks.map((skillPack) => cloneDashboardSkillPack(skillPack)),
  };
}

function cloneDashboardSkillPack(
  skillPack: DashboardRepresentativeSkillPack,
): DashboardRepresentativeSkillPack {
  return {
    ...skillPack,
    capabilityTags: [...skillPack.capabilityTags],
  };
}

function buildDemoFallbackLinkId(skillPackSlug: string, index: number): string {
  return `demo:${skillPackSlug}:${index}`;
}

function shouldUseDemoFallback(error: unknown, representativeSlug: string): boolean {
  return representativeSlug === demoRepresentative.slug && isPrismaUnavailableError(error);
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

function parseCapabilityTags(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function mapPricingPlanType(tier: string): PricingPlanType {
  switch (tier) {
    case "free":
      return PricingPlanType.FREE;
    case "pass":
      return PricingPlanType.PASS;
    case "deep_help":
      return PricingPlanType.DEEP_HELP;
    case "sponsor":
      return PricingPlanType.SPONSOR;
    default:
      return PricingPlanType.FREE;
  }
}

function mapGroupActivationToDb(value: DomainGroupActivation): GroupActivation {
  switch (value) {
    case "mention_only":
      return GroupActivation.MENTION_ONLY;
    case "always":
      return GroupActivation.ALWAYS;
    case "reply_or_mention":
    default:
      return GroupActivation.REPLY_OR_MENTION;
  }
}

function mapGroupActivationFromDb(value: GroupActivation): DomainGroupActivation {
  switch (value) {
    case GroupActivation.MENTION_ONLY:
      return "mention_only";
    case GroupActivation.ALWAYS:
      return "always";
    case GroupActivation.REPLY_OR_MENTION:
    default:
      return "reply_or_mention";
  }
}

function mapSkillPackSourceToDb(value: DomainSkillPack["source"]): SkillPackSource {
  switch (value) {
    case "clawhub":
      return SkillPackSource.CLAWHUB;
    case "owner_upload":
      return SkillPackSource.OWNER_UPLOAD;
    case "builtin":
    default:
      return SkillPackSource.BUILTIN;
  }
}

function mapSkillPackSourceFromDb(value: SkillPackSource): DomainSkillPack["source"] {
  switch (value) {
    case SkillPackSource.CLAWHUB:
      return "clawhub";
    case SkillPackSource.OWNER_UPLOAD:
      return "owner_upload";
    case SkillPackSource.BUILTIN:
    default:
      return "builtin";
  }
}

function normalizeInstallStatus(value: string): DomainSkillPack["installStatus"] {
  if (value === "installed" || value === "update_available") {
    return value;
  }
  return "available";
}
