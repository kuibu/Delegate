import { posix as pathPosix } from "node:path";

import { SessionError } from "./session-error";

export function normalizeContainerPath(rawPath: string) {
  const trimmed = rawPath.trim();
  const normalized = pathPosix.normalize(
    trimmed.startsWith("/") ? trimmed : `/workspace/${trimmed}`,
  );

  if (normalized.startsWith("/workspace") || normalized.startsWith("/tmp")) {
    return normalized;
  }

  throw new SessionError(400, "path_outside_allowed_workspace");
}
