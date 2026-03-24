function sanitizeSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";
}

export function buildRepresentativeResourceRootUri(representativeSlug: string): string {
  return `viking://resources/delegate/reps/${sanitizeSegment(representativeSlug)}/`;
}

export function buildRepresentativeIdentityUri(representativeSlug: string): string {
  return `${buildRepresentativeResourceRootUri(representativeSlug)}identity/profile.md`;
}

export function buildRepresentativeFaqUri(representativeSlug: string): string {
  return `${buildRepresentativeResourceRootUri(representativeSlug)}faq/index.md`;
}

export function buildRepresentativeMaterialsUri(representativeSlug: string): string {
  return `${buildRepresentativeResourceRootUri(representativeSlug)}materials/index.md`;
}

export function buildRepresentativePoliciesUri(representativeSlug: string): string {
  return `${buildRepresentativeResourceRootUri(representativeSlug)}policies/index.md`;
}

export function buildRepresentativePricingUri(representativeSlug: string): string {
  return `${buildRepresentativeResourceRootUri(representativeSlug)}pricing/index.md`;
}

export function buildRepresentativeContactMemoryRootUri(
  representativeSlug: string,
  contactId: string,
): string {
  return `viking://user/memories/delegate/${sanitizeSegment(representativeSlug)}/${sanitizeSegment(contactId)}/`;
}

export function buildRepresentativeContactMemoryUri(params: {
  representativeSlug: string;
  contactId: string;
  category: "profile" | "preferences" | "entities" | "events";
  key: string;
}): string {
  return `${buildRepresentativeContactMemoryRootUri(
    params.representativeSlug,
    params.contactId,
  )}${sanitizeSegment(params.category)}/${sanitizeSegment(params.key)}.md`;
}

export function buildRepresentativeAgentMemoryRootUri(representativeSlug: string): string {
  return `viking://agent/memories/delegate/${sanitizeSegment(representativeSlug)}/`;
}

export function buildRepresentativeAgentMemoryUri(params: {
  representativeSlug: string;
  category: "cases" | "patterns";
  key: string;
}): string {
  return `${buildRepresentativeAgentMemoryRootUri(params.representativeSlug)}${sanitizeSegment(
    params.category,
  )}/${sanitizeSegment(params.key)}.md`;
}

export function buildSessionScopedSearchRoot(params: {
  representativeSlug: string;
  contactId: string;
}): string[] {
  return [
    buildRepresentativeResourceRootUri(params.representativeSlug),
    buildRepresentativeContactMemoryRootUri(params.representativeSlug, params.contactId),
    buildRepresentativeAgentMemoryRootUri(params.representativeSlug),
  ];
}

export function buildSyncStagingUri(representativeSlug: string, filename: string): string {
  return `${buildRepresentativeResourceRootUri(representativeSlug)}sync/${sanitizeSegment(filename)}.md`;
}

export function sanitizeVikingSegment(value: string): string {
  return sanitizeSegment(value);
}
