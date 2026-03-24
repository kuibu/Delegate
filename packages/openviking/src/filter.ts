const SENSITIVE_PATTERNS = [
  /\bapi[_ -]?key\b/i,
  /\bsecret\b/i,
  /\btoken\b/i,
  /\bpassword\b/i,
  /\bpasswd\b/i,
  /\bcookie\b/i,
  /\bcredential\b/i,
  /\bssh\b/i,
  /\bprivate[-_ ]?key\b/i,
];

export function isPublicSafeText(text: string): boolean {
  const normalized = text.trim();
  if (!normalized) {
    return false;
  }

  return !SENSITIVE_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function sanitizePublicSafeText(text: string, maxLength = 2000): string | null {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized || !isPublicSafeText(normalized)) {
    return null;
  }

  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 3)}...` : normalized;
}

export function compactMarkdownLines(lines: string[]): string {
  return lines.map((line) => line.trim()).filter(Boolean).join("\n");
}

export function redactUnsafeObject<T extends Record<string, string | number | boolean | null | undefined>>(
  value: T,
): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => {
      if (typeof entry !== "string") {
        return true;
      }
      return isPublicSafeText(entry);
    }),
  ) as Partial<T>;
}
