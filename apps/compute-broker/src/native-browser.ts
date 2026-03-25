import {
  nativeComputerUsePreflightResponseSchema,
  type BrowserTransportKind,
  type NativeComputerProviderSnapshot,
  type NativeComputerUsePreflightSnapshot,
} from "@delegate/compute-protocol";

import { computeBrokerConfig } from "./config";
import { prisma } from "./prisma";

type BrowserSessionPreflightRecord = {
  id: string;
  computeSessionId: string;
  transportKind: string;
  currentUrl: string | null;
  currentTitle: string | null;
  lastNavigationAt: Date | null;
  latestNavigation:
    | {
        id: string;
        requestedUrl: string;
        finalUrl: string | null;
        textSnippet: string | null;
        screenshotArtifactId: string | null;
        jsonArtifactId: string | null;
      }
    | null
    | undefined;
};

export async function getNativeComputerUsePreflight(
  sessionId?: string | null,
): Promise<{ preflight: NativeComputerUsePreflightSnapshot }> {
  const providerReadiness = getNativeComputerProviderReadiness();
  if (!sessionId) {
    return nativeComputerUsePreflightResponseSchema.parse({
      preflight: deriveNativeComputerUsePreflight({
        sessionId: null,
        browserSession: null,
        providerReadiness,
      }),
    });
  }

  const browserSession = await prisma.browserSession.findUnique({
    where: {
      computeSessionId: sessionId,
    },
    include: {
      navigations: {
        orderBy: [{ createdAt: "desc" }],
        take: 1,
      },
    },
  });

  return nativeComputerUsePreflightResponseSchema.parse({
    preflight: deriveNativeComputerUsePreflight({
      sessionId,
      browserSession: browserSession
        ? {
            id: browserSession.id,
            computeSessionId: browserSession.computeSessionId,
            transportKind: browserSession.transportKind.toLowerCase(),
            currentUrl: browserSession.currentUrl,
            currentTitle: browserSession.currentTitle,
            lastNavigationAt: browserSession.lastNavigationAt,
            latestNavigation: browserSession.navigations[0]
              ? {
                  id: browserSession.navigations[0].id,
                  requestedUrl: browserSession.navigations[0].requestedUrl,
                  finalUrl: browserSession.navigations[0].finalUrl,
                  textSnippet: browserSession.navigations[0].textSnippet,
                  screenshotArtifactId: browserSession.navigations[0].screenshotArtifactId,
                  jsonArtifactId: browserSession.navigations[0].jsonArtifactId,
                }
              : null,
          }
        : null,
      providerReadiness,
    }),
  });
}

export function deriveNativeComputerUsePreflight(params: {
  sessionId?: string | null;
  browserSession?: BrowserSessionPreflightRecord | null;
  providerReadiness: NativeComputerProviderSnapshot[];
}): NativeComputerUsePreflightSnapshot {
  const browserSession = params.browserSession ?? null;
  const readyProviders = params.providerReadiness.filter((provider) => provider.status === "ready");
  const preferredProvider = readyProviders[0]?.provider ?? null;
  const targetTransportKind = preferredProvider
    ? mapProviderToTransportKind(preferredProvider)
    : null;

  if (!browserSession) {
    return {
      state: "no_browser_session",
      sessionId: params.sessionId ?? null,
      browserSessionId: null,
      preferredProvider,
      targetTransportKind,
      requiresApprovalForMutations: true,
      supportsSessionReuse: true,
      providerReadiness: params.providerReadiness,
      nextStep:
        "Run a governed browser step first so Delegate has a retained screenshot and page state for native computer-use handoff.",
    };
  }

  const latestNavigation = browserSession.latestNavigation ?? null;
  if (!latestNavigation?.screenshotArtifactId) {
    return {
      state: "missing_screenshot",
      sessionId: browserSession.computeSessionId,
      browserSessionId: browserSession.id,
      browserTransportKind: normalizeBrowserTransportKind(browserSession.transportKind),
      preferredProvider,
      targetTransportKind,
      ...(browserSession.currentUrl ? { currentUrl: browserSession.currentUrl } : {}),
      ...(browserSession.currentTitle ? { currentTitle: browserSession.currentTitle } : {}),
      ...(latestNavigation?.id ? { latestNavigationId: latestNavigation.id } : {}),
      ...(browserSession.lastNavigationAt
        ? { latestNavigationAt: browserSession.lastNavigationAt.toISOString() }
        : {}),
      ...(latestNavigation?.requestedUrl ? { latestRequestedUrl: latestNavigation.requestedUrl } : {}),
      ...(latestNavigation?.finalUrl ? { latestFinalUrl: latestNavigation.finalUrl } : {}),
      ...(latestNavigation?.textSnippet ? { latestTextSnippet: latestNavigation.textSnippet } : {}),
      ...(latestNavigation?.jsonArtifactId ? { latestJsonArtifactId: latestNavigation.jsonArtifactId } : {}),
      requiresApprovalForMutations: true,
      supportsSessionReuse: true,
      providerReadiness: params.providerReadiness,
      nextStep:
        "Capture a fresh governed screenshot artifact in this browser session before handing off to a native computer-use provider.",
    };
  }

  if (!readyProviders.length) {
    return {
      state: "no_ready_providers",
      sessionId: browserSession.computeSessionId,
      browserSessionId: browserSession.id,
      browserTransportKind: normalizeBrowserTransportKind(browserSession.transportKind),
      preferredProvider: null,
      targetTransportKind: null,
      ...(browserSession.currentUrl ? { currentUrl: browserSession.currentUrl } : {}),
      ...(browserSession.currentTitle ? { currentTitle: browserSession.currentTitle } : {}),
      ...(latestNavigation.id ? { latestNavigationId: latestNavigation.id } : {}),
      ...(browserSession.lastNavigationAt
        ? { latestNavigationAt: browserSession.lastNavigationAt.toISOString() }
        : {}),
      latestRequestedUrl: latestNavigation.requestedUrl,
      ...(latestNavigation.finalUrl ? { latestFinalUrl: latestNavigation.finalUrl } : {}),
      ...(latestNavigation.textSnippet ? { latestTextSnippet: latestNavigation.textSnippet } : {}),
      latestScreenshotArtifactId: latestNavigation.screenshotArtifactId,
      ...(latestNavigation.jsonArtifactId ? { latestJsonArtifactId: latestNavigation.jsonArtifactId } : {}),
      requiresApprovalForMutations: true,
      supportsSessionReuse: true,
      providerReadiness: params.providerReadiness,
      nextStep:
        "Configure at least one native computer-use provider model and credentials before enabling the next browser lane.",
    };
  }

  return {
    state: "ready",
    sessionId: browserSession.computeSessionId,
    browserSessionId: browserSession.id,
    browserTransportKind: normalizeBrowserTransportKind(browserSession.transportKind),
    preferredProvider,
    targetTransportKind,
    ...(browserSession.currentUrl ? { currentUrl: browserSession.currentUrl } : {}),
    ...(browserSession.currentTitle ? { currentTitle: browserSession.currentTitle } : {}),
    latestNavigationId: latestNavigation.id,
    ...(browserSession.lastNavigationAt
      ? { latestNavigationAt: browserSession.lastNavigationAt.toISOString() }
      : {}),
    latestRequestedUrl: latestNavigation.requestedUrl,
    ...(latestNavigation.finalUrl ? { latestFinalUrl: latestNavigation.finalUrl } : {}),
    ...(latestNavigation.textSnippet ? { latestTextSnippet: latestNavigation.textSnippet } : {}),
    latestScreenshotArtifactId: latestNavigation.screenshotArtifactId,
    ...(latestNavigation.jsonArtifactId ? { latestJsonArtifactId: latestNavigation.jsonArtifactId } : {}),
    requiresApprovalForMutations: true,
    supportsSessionReuse: true,
    providerReadiness: params.providerReadiness,
    nextStep:
      "This browser session now has the retained screenshot, page summary, and provider readiness needed for a future native computer-use loop.",
  };
}

export function getNativeComputerProviderReadiness(
  env: NodeJS.ProcessEnv = process.env,
): NativeComputerProviderSnapshot[] {
  return [
    buildProviderReadiness({
      provider: "openai",
      enabled: parseBoolean(
        env.COMPUTE_NATIVE_OPENAI_ENABLED,
        computeBrokerConfig.nativeComputerUse.openai.enabled,
      ),
      ...(() => {
        const model =
          normalizeOptionalString(env.COMPUTE_NATIVE_OPENAI_MODEL) ??
          computeBrokerConfig.nativeComputerUse.openai.model;
        return model ? { model } : {};
      })(),
      hasCredentials: Boolean(normalizeOptionalString(env.OPENAI_API_KEY)),
    }),
    buildProviderReadiness({
      provider: "anthropic",
      enabled: parseBoolean(
        env.COMPUTE_NATIVE_ANTHROPIC_ENABLED,
        computeBrokerConfig.nativeComputerUse.anthropic.enabled,
      ),
      ...(() => {
        const model =
          normalizeOptionalString(env.COMPUTE_NATIVE_ANTHROPIC_MODEL) ??
          computeBrokerConfig.nativeComputerUse.anthropic.model;
        return model ? { model } : {};
      })(),
      hasCredentials: Boolean(normalizeOptionalString(env.ANTHROPIC_API_KEY)),
    }),
  ];
}

function buildProviderReadiness(params: {
  provider: "openai" | "anthropic";
  enabled: boolean;
  model?: string;
  hasCredentials: boolean;
}): NativeComputerProviderSnapshot {
  if (!params.enabled) {
    return {
      provider: params.provider,
      enabled: false,
      status: "disabled",
      transportKind: mapProviderToTransportKind(params.provider),
      ...(params.model ? { model: params.model } : {}),
      reason: "provider_disabled",
    };
  }

  if (!params.model) {
    return {
      provider: params.provider,
      enabled: true,
      status: "missing_model",
      transportKind: mapProviderToTransportKind(params.provider),
      reason: "native_model_not_configured",
    };
  }

  if (!params.hasCredentials) {
    return {
      provider: params.provider,
      enabled: true,
      status: "missing_credentials",
      model: params.model,
      transportKind: mapProviderToTransportKind(params.provider),
      reason: "provider_credentials_missing",
    };
  }

  return {
    provider: params.provider,
    enabled: true,
    status: "ready",
    model: params.model,
    transportKind: mapProviderToTransportKind(params.provider),
    reason: null,
  };
}

function mapProviderToTransportKind(provider: "openai" | "anthropic"): BrowserTransportKind {
  return provider === "openai" ? "openai_computer" : "claude_computer_use";
}

function normalizeBrowserTransportKind(value: string): BrowserTransportKind {
  if (value === "OPENAI_COMPUTER" || value === "openai_computer") {
    return "openai_computer";
  }
  if (value === "CLAUDE_COMPUTER_USE" || value === "claude_computer_use") {
    return "claude_computer_use";
  }
  return "playwright";
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return defaultValue;
}
