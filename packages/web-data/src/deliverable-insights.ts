type DeliverableKind = "deck" | "case_study" | "download" | "generated_document" | "package";
type DeliverableVisibility = "owner_only" | "public_material";
type DeliverableSourceKind = "artifact" | "external_link" | "bundle";
type ArtifactKind = "stdout" | "stderr" | "file" | "archive" | "screenshot" | "json" | "trace";

export type DeliverableInsightsArtifact = {
  id: string;
  kind: ArtifactKind;
  isPinned: boolean;
  sizeBytes: number;
  createdAt: string;
};

export type DeliverableInsightsDeliverable = {
  id: string;
  title: string;
  summary: string;
  kind: DeliverableKind;
  visibility: DeliverableVisibility;
  sourceKind: DeliverableSourceKind;
  artifactId?: string | null;
  bundleItemArtifactIds: string[];
  downloadCount: number;
  lastDownloadedAt?: string | null;
  updatedAt: string;
  packageBuiltAt?: string | null;
  packageSizeBytes?: number | null;
  packageCacheKey?: string | null;
};

export type DeliverableInsightsSource = {
  representative: {
    slug: string;
    displayName: string;
  };
  deliverables: DeliverableInsightsDeliverable[];
  artifacts: DeliverableInsightsArtifact[];
  oversizedBundleAttempts?: number;
};

export type DeliverablePackagingPresetKey =
  | "deck"
  | "package"
  | "case_study"
  | "download_pack"
  | "generated_document";

export type DeliverablePackagingPresetSnapshot = {
  key: DeliverablePackagingPresetKey;
  kind: DeliverableKind;
  visibility: DeliverableVisibility;
  sourceKind: DeliverableSourceKind;
  title: string;
  summary: string;
  recommendedPublicMaterial: boolean;
  suggestedArtifactKinds: ArtifactKind[];
  bundleItemArtifactIds: string[];
  artifactId?: string | null;
};

export type RepresentativeDeliverableInsightsSnapshot = {
  representative: {
    slug: string;
    displayName: string;
  };
  summary: {
    totalDeliverables: number;
    publicMaterials: number;
    totalDownloads: number;
    bundlePackageDownloads: number;
    pinnedArtifactsReused: number;
  };
  byKind: Array<{
    key: DeliverableKind;
    count: number;
    totalDownloads: number;
  }>;
  bySourceKind: Array<{
    key: DeliverableSourceKind;
    count: number;
    totalDownloads: number;
  }>;
  byVisibility: Array<{
    key: DeliverableVisibility;
    count: number;
    totalDownloads: number;
  }>;
  topDeliverables: {
    mostDownloaded: Array<{
      id: string;
      title: string;
      downloadCount: number;
      visibility: DeliverableVisibility;
    }>;
    mostRecentlyDownloaded: Array<{
      id: string;
      title: string;
      lastDownloadedAt: string;
      downloadCount: number;
    }>;
    mostRecentlyUpdated: Array<{
      id: string;
      title: string;
      updatedAt: string;
    }>;
  };
  artifactReuseHotspots: Array<{
    artifactId: string;
    artifactKind: ArtifactKind;
    reuseCount: number;
    isPinned: boolean;
  }>;
  packageHealth: {
    cachedPackageCount: number;
    stalePackageCount: number;
    oversizedBundleAttempts: number;
  };
};

const kindOrder: DeliverableKind[] = [
  "deck",
  "case_study",
  "download",
  "generated_document",
  "package",
];

const sourceKindOrder: DeliverableSourceKind[] = ["artifact", "external_link", "bundle"];
const visibilityOrder: DeliverableVisibility[] = ["owner_only", "public_material"];

const presetDefinitions: Record<
  DeliverablePackagingPresetKey,
  {
    kind: DeliverableKind;
    visibility: DeliverableVisibility;
    sourceKind: DeliverableSourceKind;
    recommendedPublicMaterial: boolean;
    titleSuffix: string;
    summary: string;
    preferredArtifactKinds: ArtifactKind[];
    fallbackSourceKind?: DeliverableSourceKind;
    maxItems: number;
  }
> = {
  deck: {
    kind: "deck",
    visibility: "public_material",
    sourceKind: "bundle",
    recommendedPublicMaterial: true,
    titleSuffix: "intro deck",
    summary: "A concise bundle of visuals and structured context for fast sharing.",
    preferredArtifactKinds: ["screenshot", "json", "stdout"],
    maxItems: 4,
  },
  package: {
    kind: "package",
    visibility: "owner_only",
    sourceKind: "bundle",
    recommendedPublicMaterial: false,
    titleSuffix: "delivery package",
    summary: "A fuller owner-facing bundle with visuals, structured output, and raw notes.",
    preferredArtifactKinds: ["screenshot", "json", "stdout", "file", "archive", "trace"],
    maxItems: 6,
  },
  case_study: {
    kind: "case_study",
    visibility: "public_material",
    sourceKind: "bundle",
    recommendedPublicMaterial: true,
    titleSuffix: "case study",
    summary: "A public-safe before/after narrative with visuals and proof points.",
    preferredArtifactKinds: ["screenshot", "json", "stdout"],
    maxItems: 5,
  },
  download_pack: {
    kind: "download",
    visibility: "public_material",
    sourceKind: "bundle",
    recommendedPublicMaterial: true,
    titleSuffix: "download pack",
    summary: "A reusable download-ready package for sending screenshots, files, and supporting data.",
    preferredArtifactKinds: ["archive", "file", "screenshot", "json", "stdout"],
    maxItems: 8,
  },
  generated_document: {
    kind: "generated_document",
    visibility: "owner_only",
    sourceKind: "artifact",
    fallbackSourceKind: "bundle",
    recommendedPublicMaterial: false,
    titleSuffix: "generated document",
    summary: "A document-first handoff, preferring a single deliverable file when one exists.",
    preferredArtifactKinds: ["file", "archive", "json", "stdout"],
    maxItems: 3,
  },
};

export function buildRepresentativeDeliverableInsights(
  source: DeliverableInsightsSource,
): RepresentativeDeliverableInsightsSnapshot {
  const summary = {
    totalDeliverables: source.deliverables.length,
    publicMaterials: source.deliverables.filter((deliverable) => deliverable.visibility === "public_material")
      .length,
    totalDownloads: source.deliverables.reduce((sum, deliverable) => sum + deliverable.downloadCount, 0),
    bundlePackageDownloads: source.deliverables
      .filter((deliverable) => deliverable.sourceKind === "bundle" || deliverable.kind === "package")
      .reduce((sum, deliverable) => sum + deliverable.downloadCount, 0),
    pinnedArtifactsReused: countPinnedArtifactsReused(source.deliverables, source.artifacts),
  };

  const byKind = kindOrder.map((key) => ({
    key,
    count: source.deliverables.filter((deliverable) => deliverable.kind === key).length,
    totalDownloads: source.deliverables
      .filter((deliverable) => deliverable.kind === key)
      .reduce((sum, deliverable) => sum + deliverable.downloadCount, 0),
  }));

  const bySourceKind = sourceKindOrder.map((key) => ({
    key,
    count: source.deliverables.filter((deliverable) => deliverable.sourceKind === key).length,
    totalDownloads: source.deliverables
      .filter((deliverable) => deliverable.sourceKind === key)
      .reduce((sum, deliverable) => sum + deliverable.downloadCount, 0),
  }));

  const byVisibility = visibilityOrder.map((key) => ({
    key,
    count: source.deliverables.filter((deliverable) => deliverable.visibility === key).length,
    totalDownloads: source.deliverables
      .filter((deliverable) => deliverable.visibility === key)
      .reduce((sum, deliverable) => sum + deliverable.downloadCount, 0),
  }));

  const topDeliverables = {
    mostDownloaded: [...source.deliverables]
      .sort((left, right) => {
        if (right.downloadCount !== left.downloadCount) {
          return right.downloadCount - left.downloadCount;
        }
        return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
      })
      .slice(0, 5)
      .map((deliverable) => ({
        id: deliverable.id,
        title: deliverable.title,
        downloadCount: deliverable.downloadCount,
        visibility: deliverable.visibility,
      })),
    mostRecentlyDownloaded: source.deliverables
      .filter((deliverable) => Boolean(deliverable.lastDownloadedAt))
      .sort(
        (left, right) =>
          new Date(right.lastDownloadedAt ?? right.updatedAt).getTime() -
          new Date(left.lastDownloadedAt ?? left.updatedAt).getTime(),
      )
      .slice(0, 5)
      .map((deliverable) => ({
        id: deliverable.id,
        title: deliverable.title,
        lastDownloadedAt: deliverable.lastDownloadedAt ?? deliverable.updatedAt,
        downloadCount: deliverable.downloadCount,
      })),
    mostRecentlyUpdated: [...source.deliverables]
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
      .slice(0, 5)
      .map((deliverable) => ({
        id: deliverable.id,
        title: deliverable.title,
        updatedAt: deliverable.updatedAt,
      })),
  };

  const artifactReuse = buildArtifactReuseCounts(source.deliverables, source.artifacts);
  const packageHealth = {
    cachedPackageCount: source.deliverables.filter(
      (deliverable) => deliverable.sourceKind === "bundle" && Boolean(deliverable.packageBuiltAt),
    ).length,
    stalePackageCount: source.deliverables.filter(
      (deliverable) =>
        deliverable.sourceKind === "bundle" &&
        (!deliverable.packageBuiltAt || !deliverable.packageCacheKey || !deliverable.packageSizeBytes),
    ).length,
    oversizedBundleAttempts: source.oversizedBundleAttempts ?? 0,
  };

  return {
    representative: source.representative,
    summary,
    byKind,
    bySourceKind,
    byVisibility,
    topDeliverables,
    artifactReuseHotspots: artifactReuse,
    packageHealth,
  };
}

export function buildDeliverablePackagingPresets(input: {
  representativeDisplayName: string;
  artifacts: DeliverableInsightsArtifact[];
}): DeliverablePackagingPresetSnapshot[] {
  return (Object.keys(presetDefinitions) as DeliverablePackagingPresetKey[]).map((key) =>
    buildDeliverablePackagingPreset({
      key,
      representativeDisplayName: input.representativeDisplayName,
      artifacts: input.artifacts,
    }),
  );
}

export function buildDeliverablePackagingPreset(input: {
  key: DeliverablePackagingPresetKey;
  representativeDisplayName: string;
  artifacts: DeliverableInsightsArtifact[];
}): DeliverablePackagingPresetSnapshot {
  const definition = presetDefinitions[input.key];
  const selectedArtifacts = selectArtifactsForPackagingPreset(
    input.key,
    input.artifacts,
    definition.maxItems,
  );
  const primaryArtifact =
    definition.sourceKind === "artifact"
      ? selectedArtifacts[0] ?? null
      : null;

  const sourceKind =
    definition.sourceKind === "artifact" && !primaryArtifact
      ? definition.fallbackSourceKind ?? "bundle"
      : definition.sourceKind;

  return {
    key: input.key,
    kind: definition.kind,
    visibility: definition.visibility,
    sourceKind,
    title: `${input.representativeDisplayName} ${definition.titleSuffix}`,
    summary: definition.summary,
    recommendedPublicMaterial: definition.recommendedPublicMaterial,
    suggestedArtifactKinds: definition.preferredArtifactKinds,
    bundleItemArtifactIds:
      sourceKind === "bundle" ? selectedArtifacts.map((artifact) => artifact.id) : [],
    ...(sourceKind === "artifact" && primaryArtifact ? { artifactId: primaryArtifact.id } : {}),
  };
}

export function selectArtifactsForPackagingPreset(
  key: DeliverablePackagingPresetKey,
  artifacts: DeliverableInsightsArtifact[],
  limit?: number,
): DeliverableInsightsArtifact[] {
  const definition = presetDefinitions[key];
  const cappedLimit = limit ?? definition.maxItems;
  const pinnedArtifacts = artifacts.filter((artifact) => artifact.isPinned);
  const priority = new Map(
    definition.preferredArtifactKinds.map((kind, index) => [kind, index] as const),
  );

  return [...pinnedArtifacts]
    .sort((left, right) => {
      const leftPriority = priority.get(left.kind) ?? definition.preferredArtifactKinds.length + 1;
      const rightPriority = priority.get(right.kind) ?? definition.preferredArtifactKinds.length + 1;
      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }
      if (right.createdAt !== left.createdAt) {
        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      }
      return left.id.localeCompare(right.id);
    })
    .slice(0, cappedLimit);
}

export function computeDeliverablePackageCacheKey(input: {
  representativeSlug: string;
  deliverableId: string;
  artifactIds: string[];
  artifactFingerprints: Array<{
    id: string;
    sha256: string;
    sizeBytes: number;
    fileName: string;
  }>;
}): string {
  return JSON.stringify({
    representativeSlug: input.representativeSlug,
    deliverableId: input.deliverableId,
    artifactIds: input.artifactIds,
    artifactFingerprints: input.artifactFingerprints,
  });
}

function countPinnedArtifactsReused(
  deliverables: DeliverableInsightsDeliverable[],
  artifacts: DeliverableInsightsArtifact[],
) {
  const reusedArtifactIds = new Set<string>();
  for (const deliverable of deliverables) {
    if (deliverable.artifactId) {
      reusedArtifactIds.add(deliverable.artifactId);
    }
    for (const artifactId of deliverable.bundleItemArtifactIds) {
      reusedArtifactIds.add(artifactId);
    }
  }

  return artifacts.filter((artifact) => artifact.isPinned && reusedArtifactIds.has(artifact.id)).length;
}

function buildArtifactReuseCounts(
  deliverables: DeliverableInsightsDeliverable[],
  artifacts: DeliverableInsightsArtifact[],
) {
  const artifactLookup = new Map(artifacts.map((artifact) => [artifact.id, artifact] as const));
  const reuseCounts = new Map<string, number>();

  for (const deliverable of deliverables) {
    if (deliverable.artifactId) {
      reuseCounts.set(deliverable.artifactId, (reuseCounts.get(deliverable.artifactId) ?? 0) + 1);
    }
    for (const artifactId of deliverable.bundleItemArtifactIds) {
      reuseCounts.set(artifactId, (reuseCounts.get(artifactId) ?? 0) + 1);
    }
  }

  return [...reuseCounts.entries()]
    .map(([artifactId, reuseCount]) => {
      const artifact = artifactLookup.get(artifactId);
      return artifact
        ? {
            artifactId,
            artifactKind: artifact.kind,
            reuseCount,
            isPinned: artifact.isPinned,
          }
        : null;
    })
    .filter((value): value is NonNullable<typeof value> => value !== null)
    .sort((left, right) => {
      if (right.reuseCount !== left.reuseCount) {
        return right.reuseCount - left.reuseCount;
      }
      return left.artifactId.localeCompare(right.artifactId);
    })
    .slice(0, 8);
}
