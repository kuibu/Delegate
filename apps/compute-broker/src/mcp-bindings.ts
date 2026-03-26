import { SessionError } from "./session-error";
import { prisma } from "./prisma";

export async function loadRepresentativeMcpBinding(params: {
  representativeId: string;
  bindingId?: string | null | undefined;
  bindingSlug?: string | null | undefined;
  requireEnabled?: boolean;
}) {
  if (!params.bindingId && !params.bindingSlug) {
    throw new SessionError(400, "mcp_binding_reference_required");
  }

  const binding = params.bindingId
    ? await prisma.representativeMcpBinding.findFirst({
        where: {
          id: params.bindingId,
          representativeId: params.representativeId,
        },
      })
    : await prisma.representativeMcpBinding.findFirst({
        where: {
          representativeId: params.representativeId,
          ...(params.bindingSlug ? { slug: params.bindingSlug } : {}),
        },
      });

  if (!binding) {
    throw new SessionError(404, "mcp_binding_not_found");
  }

  if ((params.requireEnabled ?? true) && !binding.enabled) {
    throw new SessionError(409, "mcp_binding_disabled");
  }

  return binding;
}

export function parseAllowedToolNames(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function resolveMcpToolName(params: {
  binding: {
    allowedToolNames: unknown;
    defaultToolName: string | null;
  };
  requestedToolName?: string | null | undefined;
}) {
  const allowedToolNames = parseAllowedToolNames(params.binding.allowedToolNames);
  const toolName =
    params.requestedToolName?.trim() ||
    params.binding.defaultToolName?.trim() ||
    allowedToolNames[0];

  if (!toolName) {
    throw new SessionError(400, "mcp_tool_name_required");
  }

  if (allowedToolNames.length > 0 && !allowedToolNames.includes(toolName)) {
    throw new SessionError(403, "mcp_tool_not_allowed_for_binding");
  }

  return {
    toolName,
    allowedToolNames,
  };
}

export async function recordRepresentativeMcpBindingSuccess(bindingId: string) {
  await prisma.representativeMcpBinding.update({
    where: { id: bindingId },
    data: {
      consecutiveFailures: 0,
      lastSuccessAt: new Date(),
    },
  });
}

export async function recordRepresentativeMcpBindingFailure(params: {
  bindingId: string;
  failureReason: string;
}) {
  await prisma.representativeMcpBinding.update({
    where: { id: params.bindingId },
    data: {
      consecutiveFailures: {
        increment: 1,
      },
      lastFailureAt: new Date(),
      lastFailureReason: params.failureReason,
    },
  });
}
