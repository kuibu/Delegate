function normalizeAllowlistEntry(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }

  const wildcard = trimmed.startsWith("*.");
  const candidate = wildcard ? trimmed.slice(2) : trimmed;

  const hostname = extractHostname(candidate);
  if (!hostname) {
    return null;
  }

  return wildcard ? `*.${hostname}` : hostname;
}

export function normalizeNetworkAllowlist(entries: unknown): string[] {
  if (!Array.isArray(entries)) {
    return [];
  }

  const deduped = new Set<string>();
  for (const entry of entries) {
    if (typeof entry !== "string") {
      continue;
    }

    const normalized = normalizeAllowlistEntry(entry);
    if (normalized) {
      deduped.add(normalized);
    }
  }

  return [...deduped];
}

export function extractHostname(value: string): string | null {
  const candidate = value.trim();
  if (!candidate) {
    return null;
  }

  const raw = candidate.includes("://") ? candidate : `https://${candidate}`;

  try {
    const hostname = new URL(raw).hostname.trim().toLowerCase();
    return hostname ? hostname : null;
  } catch {
    return null;
  }
}

export function isHostnameAllowed(hostname: string, allowlist: readonly string[]): boolean {
  const normalizedHostname = extractHostname(hostname);
  if (!normalizedHostname) {
    return false;
  }

  for (const rawEntry of allowlist) {
    const entry = normalizeAllowlistEntry(rawEntry);
    if (!entry) {
      continue;
    }

    if (entry.startsWith("*.")) {
      const suffix = entry.slice(1);
      if (
        normalizedHostname.length > suffix.length &&
        normalizedHostname.endsWith(suffix)
      ) {
        return true;
      }
      continue;
    }

    if (normalizedHostname === entry) {
      return true;
    }
  }

  return false;
}
