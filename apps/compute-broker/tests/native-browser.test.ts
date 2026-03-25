import { describe, expect, it } from "vitest";

describe("getNativeComputerProviderReadiness", () => {
  it("reports missing model and credentials without pretending readiness", async () => {
    process.env.COMPUTE_BROKER_INTERNAL_TOKEN ??= "test-internal-token";
    const { getNativeComputerProviderReadiness } = await import("../src/native-browser");
    const readiness = getNativeComputerProviderReadiness({
      COMPUTE_NATIVE_OPENAI_ENABLED: "true",
      COMPUTE_NATIVE_OPENAI_MODEL: "",
      COMPUTE_NATIVE_ANTHROPIC_ENABLED: "true",
      COMPUTE_NATIVE_ANTHROPIC_MODEL: "claude-computer",
      ANTHROPIC_API_KEY: "",
    });

    expect(readiness).toEqual([
      {
        provider: "openai",
        enabled: true,
        status: "missing_model",
        transportKind: "openai_computer",
        reason: "native_model_not_configured",
      },
      {
        provider: "anthropic",
        enabled: true,
        status: "missing_credentials",
        model: "claude-computer",
        transportKind: "claude_computer_use",
        reason: "provider_credentials_missing",
      },
    ]);
  });
});

describe("deriveNativeComputerUsePreflight", () => {
  const providerReadiness = [
    {
      provider: "openai" as const,
      enabled: true,
      status: "ready" as const,
      model: "computer-use-openai",
      transportKind: "openai_computer" as const,
      reason: null,
    },
  ];

  it("reports no browser session when there is nothing to hand off", async () => {
    process.env.COMPUTE_BROKER_INTERNAL_TOKEN ??= "test-internal-token";
    const { deriveNativeComputerUsePreflight } = await import("../src/native-browser");
    const preflight = deriveNativeComputerUsePreflight({
      sessionId: "session_demo",
      browserSession: null,
      providerReadiness,
    });

    expect(preflight.state).toBe("no_browser_session");
    expect(preflight.sessionId).toBe("session_demo");
    expect(preflight.browserSessionId).toBeNull();
  });

  it("reports missing screenshot before native handoff is allowed", async () => {
    process.env.COMPUTE_BROKER_INTERNAL_TOKEN ??= "test-internal-token";
    const { deriveNativeComputerUsePreflight } = await import("../src/native-browser");
    const preflight = deriveNativeComputerUsePreflight({
      sessionId: "session_demo",
      browserSession: {
        id: "browser_demo",
        computeSessionId: "session_demo",
        transportKind: "playwright",
        currentUrl: "https://example.com",
        currentTitle: "Example",
        lastNavigationAt: new Date("2026-03-25T09:00:00.000Z"),
        latestNavigation: {
          id: "nav_demo",
          requestedUrl: "https://example.com",
          finalUrl: "https://example.com",
          textSnippet: "Example page",
          screenshotArtifactId: null,
          jsonArtifactId: "artifact_json",
        },
      },
      providerReadiness,
    });

    expect(preflight.state).toBe("missing_screenshot");
    expect(preflight.latestJsonArtifactId).toBe("artifact_json");
  });

  it("returns ready when a screenshot and provider lane both exist", async () => {
    process.env.COMPUTE_BROKER_INTERNAL_TOKEN ??= "test-internal-token";
    const { deriveNativeComputerUsePreflight } = await import("../src/native-browser");
    const preflight = deriveNativeComputerUsePreflight({
      browserSession: {
        id: "browser_demo",
        computeSessionId: "session_demo",
        transportKind: "playwright",
        currentUrl: "https://example.com",
        currentTitle: "Example",
        lastNavigationAt: new Date("2026-03-25T09:00:00.000Z"),
        latestNavigation: {
          id: "nav_demo",
          requestedUrl: "https://example.com",
          finalUrl: "https://example.com",
          textSnippet: "Example page",
          screenshotArtifactId: "artifact_screen",
          jsonArtifactId: "artifact_json",
        },
      },
      providerReadiness,
    });

    expect(preflight.state).toBe("ready");
    expect(preflight.preferredProvider).toBe("openai");
    expect(preflight.targetTransportKind).toBe("openai_computer");
    expect(preflight.latestScreenshotArtifactId).toBe("artifact_screen");
  });
});
