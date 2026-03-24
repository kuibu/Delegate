import { describe, expect, it } from "vitest";

import { buildPlaywrightBrowseCommand } from "../src/browser";

describe("buildPlaywrightBrowseCommand", () => {
  it("builds a Playwright-backed browser command", () => {
    const command = buildPlaywrightBrowseCommand({
      url: "https://example.com",
      playwrightVersion: "1.58.2",
    });

    expect(command).toContain("npm install --silent --no-save playwright@1.58.2");
    expect(command).toContain("PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1");
    expect(command).toContain('require(\'"\'"\'playwright\'"\'"\')');
    expect(command).toContain("page.goto");
    expect(command).toContain("https://example.com");
  });
});
