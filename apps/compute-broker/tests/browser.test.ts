import { describe, expect, it } from "vitest";

import {
  buildPlaywrightBrowseCommand,
  parsePlaywrightBrowseArtifactPayload,
} from "../src/browser";

describe("buildPlaywrightBrowseCommand", () => {
  it("builds a Playwright-backed browser command", () => {
    const command = buildPlaywrightBrowseCommand({
      url: "https://example.com",
      playwrightVersion: "1.58.2",
    });

    expect(command).toContain("npm install --silent --no-save playwright@1.58.2");
    expect(command).toContain("PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1");
    expect(command).toContain('require(\'"\'"\'playwright\'"\'"\')');
    expect(command).toContain("launchPersistentContext");
    expect(command).toContain("browser-profile");
    expect(command).toContain("DELEGATE_SESSION_ROOT");
    expect(command).toContain("page.goto");
    expect(command).toContain("https://example.com");
    expect(command).toContain("page.screenshot");
    expect(command).toContain("type: '\"'\"'jpeg'\"'\"'");
    expect(command).toContain("screenshotBase64");
  });

  it("parses structured browser output", () => {
    const payload = parsePlaywrightBrowseArtifactPayload(
      JSON.stringify({
        transportKind: "playwright",
        profilePath: "/delegate-session/browser-profile",
        title: "Example Domain",
        finalUrl: "https://example.com/",
        textSnippet: "Example Domain This domain is for use in illustrative examples.",
        contentSnippet: "<html><body>Example Domain</body></html>",
        links: [{ text: "More information", href: "https://www.iana.org/domains/example" }],
        screenshotBase64: "cG5n",
        screenshotMimeType: "image/jpeg",
      }),
    );

    expect(payload).toEqual({
      transportKind: "playwright",
      profilePath: "/delegate-session/browser-profile",
      title: "Example Domain",
      finalUrl: "https://example.com/",
      textSnippet: "Example Domain This domain is for use in illustrative examples.",
      contentSnippet: "<html><body>Example Domain</body></html>",
      links: [{ text: "More information", href: "https://www.iana.org/domains/example" }],
      screenshotBase64: "cG5n",
      screenshotMimeType: "image/jpeg",
    });
  });

  it("returns null for malformed browser output", () => {
    expect(parsePlaywrightBrowseArtifactPayload("not-json")).toBeNull();
  });
});
