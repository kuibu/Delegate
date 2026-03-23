import type { SkillPack } from "@delegate/domain";

const DEFAULT_CLAWHUB_URL = "https://clawhub.ai";
const DEFAULT_TIMEOUT_MS = 30_000;

export type ClawHubSkillSearchResult = {
  score: number;
  slug: string;
  displayName: string;
  summary?: string;
  version?: string;
  updatedAt?: number;
};

export type ClawHubSkillDetail = {
  skill: {
    slug: string;
    displayName: string;
    summary?: string;
    tags?: Record<string, string>;
    createdAt: number;
    updatedAt: number;
  } | null;
  latestVersion?: {
    version: string;
    createdAt: number;
    changelog?: string;
  } | null;
  metadata?: {
    os?: string[] | null;
    systems?: string[] | null;
  } | null;
  owner?: {
    handle?: string | null;
    displayName?: string | null;
    image?: string | null;
  } | null;
};

export type ClawHubSkillListResponse = {
  items: Array<{
    slug: string;
    displayName: string;
    summary?: string;
    tags?: Record<string, string>;
    latestVersion?: {
      version: string;
      createdAt: number;
      changelog?: string;
    } | null;
    createdAt: number;
    updatedAt: number;
  }>;
  nextCursor?: string | null;
};

type FetchLike = typeof fetch;

type RequestParams = {
  baseUrl?: string | undefined;
  path: string;
  timeoutMs?: number | undefined;
  search?: Record<string, string | undefined> | undefined;
  fetchImpl?: FetchLike | undefined;
};

export class ClawHubRequestError extends Error {
  readonly status: number;
  readonly requestPath: string;
  readonly responseBody: string;

  constructor(params: { path: string; status: number; body: string }) {
    super(`ClawHub ${params.path} failed (${params.status}): ${params.body}`);
    this.name = "ClawHubRequestError";
    this.status = params.status;
    this.requestPath = params.path;
    this.responseBody = params.body;
  }
}

export function resolveClawHubBaseUrl(baseUrl?: string): string {
  const envValue = process.env.DELEGATE_CLAWHUB_URL?.trim();
  const value = (baseUrl?.trim() || envValue || DEFAULT_CLAWHUB_URL).replace(/\/+$/, "");
  return value || DEFAULT_CLAWHUB_URL;
}

export async function searchClawHubSkills(params: {
  query: string;
  limit?: number;
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}): Promise<ClawHubSkillSearchResult[]> {
  const result = await fetchJson<{ results: ClawHubSkillSearchResult[] }>({
    baseUrl: params.baseUrl,
    path: "/api/v1/search",
    timeoutMs: params.timeoutMs,
    fetchImpl: params.fetchImpl,
    search: {
      q: params.query.trim(),
      limit: params.limit ? String(params.limit) : undefined,
    },
  });
  return result.results ?? [];
}

export async function listClawHubSkills(params: {
  limit?: number;
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}): Promise<ClawHubSkillListResponse> {
  return fetchJson<ClawHubSkillListResponse>({
    baseUrl: params.baseUrl,
    path: "/api/v1/skills",
    timeoutMs: params.timeoutMs,
    fetchImpl: params.fetchImpl,
    search: {
      limit: params.limit ? String(params.limit) : undefined,
    },
  });
}

export async function fetchClawHubSkillDetail(params: {
  slug: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}): Promise<ClawHubSkillDetail> {
  return fetchJson<ClawHubSkillDetail>({
    baseUrl: params.baseUrl,
    path: `/api/v1/skills/${encodeURIComponent(params.slug)}`,
    timeoutMs: params.timeoutMs,
    fetchImpl: params.fetchImpl,
  });
}

export async function searchClawHubRepresentativeSkills(params: {
  query: string;
  limit?: number;
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}): Promise<SkillPack[]> {
  const query = params.query.trim();
  const results = query
    ? await searchClawHubSkills({
        ...params,
        query,
      })
    : (await listClawHubSkills(params)).items.map((item) => ({
        score: 0,
        slug: item.slug,
        displayName: item.displayName,
        summary: item.summary,
        version: item.latestVersion?.version,
        updatedAt: item.updatedAt,
      }));

  return results.map((result) => ({
    id: `clawhub:${result.slug}`,
    slug: result.slug,
    displayName: result.displayName,
    source: "clawhub",
    summary:
      result.summary ??
      "Discovered from ClawHub. Review before enabling it for a public representative runtime.",
    version: result.version,
    sourceUrl: `${resolveClawHubBaseUrl(params.baseUrl)}/skills/${result.slug}`,
    capabilityTags: [],
    executesCode: false,
    enabled: false,
    installStatus: "available",
  }));
}

export async function fetchClawHubRepresentativeSkill(params: {
  slug: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}): Promise<SkillPack | null> {
  const detail = await fetchClawHubSkillDetail(params);
  if (!detail.skill) {
    return null;
  }

  return {
    id: `clawhub:${detail.skill.slug}`,
    slug: detail.skill.slug,
    displayName: detail.skill.displayName,
    source: "clawhub",
    summary:
      detail.skill.summary ??
      "Imported from ClawHub. Review suitability for the public representative boundary before enabling.",
    version: detail.latestVersion?.version,
    sourceUrl: `${resolveClawHubBaseUrl(params.baseUrl)}/skills/${detail.skill.slug}`,
    ownerHandle: detail.owner?.handle ?? undefined,
    verificationTier: deriveVerificationTier(detail),
    capabilityTags: buildCapabilityTags(detail),
    executesCode: false,
    enabled: false,
    installStatus: "available",
  };
}

function buildUrl(params: Pick<RequestParams, "baseUrl" | "path" | "search">): URL {
  const url = new URL(params.path, `${resolveClawHubBaseUrl(params.baseUrl)}/`);
  for (const [key, value] of Object.entries(params.search ?? {})) {
    if (!value) {
      continue;
    }
    url.searchParams.set(key, value);
  }
  return url;
}

async function fetchJson<T>(params: RequestParams): Promise<T> {
  const controller = new AbortController();
  const url = buildUrl(params);
  const timeout = setTimeout(
    () => controller.abort(new Error(`ClawHub request timed out after ${params.timeoutMs ?? DEFAULT_TIMEOUT_MS}ms`)),
    params.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  try {
    const response = await (params.fetchImpl ?? fetch)(url, {
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new ClawHubRequestError({
        path: url.pathname,
        status: response.status,
        body: await readErrorBody(response),
      });
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

async function readErrorBody(response: Response): Promise<string> {
  try {
    const text = (await response.text()).trim();
    return text || response.statusText || `HTTP ${response.status}`;
  } catch {
    return response.statusText || `HTTP ${response.status}`;
  }
}

function buildCapabilityTags(detail: ClawHubSkillDetail): string[] {
  const tags = detail.skill?.tags ?? {};
  return Object.keys(tags)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .sort();
}

function deriveVerificationTier(detail: ClawHubSkillDetail): string | undefined {
  const tags = detail.skill?.tags ?? {};
  if (typeof tags.official === "string") {
    return "official";
  }
  if (typeof tags.verified === "string") {
    return "verified";
  }
  return undefined;
}
