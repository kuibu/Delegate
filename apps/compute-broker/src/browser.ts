export type PlaywrightBrowseArtifactPayload = {
  title: string;
  finalUrl: string;
  textSnippet: string;
  contentSnippet: string;
  links: Array<{
    text: string;
    href: string;
  }>;
  screenshotBase64: string;
  screenshotMimeType: "image/png" | "image/jpeg";
};

export function buildPlaywrightBrowseCommand(params: {
  url: string;
  playwrightVersion: string;
}): string {
  const script = [
    "const normalize = (value) => value.replace(/\\s+/g, ' ').trim();",
    "void (async () => {",
    "  const { chromium } = require('playwright');",
    "  const browser = await chromium.launch({",
    "    headless: true,",
    "    args: ['--no-sandbox', '--disable-dev-shm-usage'],",
    "  });",
    "  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });",
    `  await page.goto(${JSON.stringify(params.url)}, { waitUntil: 'domcontentloaded', timeout: 15000 });`,
    "  await page.waitForTimeout(750);",
    "  const title = await page.title();",
    "  const finalUrl = page.url();",
    "  const textSnippet = normalize(await page.locator('body').innerText().catch(() => '')).slice(0, 2400);",
    "  const contentSnippet = (await page.content()).slice(0, 12000);",
    "  const links = await page.locator('a[href]').evaluateAll((nodes) => nodes.slice(0, 12).map((node) => ({ text: (node.textContent || '').trim().slice(0, 120), href: node.href })));",
    "  const screenshotRaw = await page.screenshot({ type: 'jpeg', quality: 65, fullPage: false, encoding: 'base64' });",
    "  const screenshotBase64 = typeof screenshotRaw === 'string' ? screenshotRaw : screenshotRaw.toString('base64');",
    "  console.log(JSON.stringify({ title, finalUrl, textSnippet, contentSnippet, links, screenshotBase64, screenshotMimeType: 'image/jpeg' }, null, 2));",
    "  await browser.close();",
    "})().catch((error) => {",
    "  console.error(error.stack || error.message || String(error));",
    "  process.exit(1);",
    "});",
  ].join("\n");

  return [
    "mkdir -p /tmp/pw-run",
    "mkdir -p /tmp/npm-cache",
    "cd /tmp/pw-run",
    "[ -f package.json ] || npm init -y >/dev/null 2>&1",
    `HOME=/tmp npm_config_cache=/tmp/npm-cache PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 PLAYWRIGHT_BROWSERS_PATH=/ms-playwright npm install --silent --no-save playwright@${params.playwrightVersion} >/dev/null 2>&1`,
    `HOME=/tmp PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 PLAYWRIGHT_BROWSERS_PATH=/ms-playwright node -e ${shellQuote(script)}`,
  ].join("\n");
}

function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

export function parsePlaywrightBrowseArtifactPayload(stdout: string): PlaywrightBrowseArtifactPayload | null {
  const trimmed = stdout.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    if (
      typeof parsed.title !== "string" ||
      typeof parsed.finalUrl !== "string" ||
      typeof parsed.textSnippet !== "string" ||
      typeof parsed.contentSnippet !== "string" ||
      typeof parsed.screenshotBase64 !== "string" ||
      (parsed.screenshotMimeType !== "image/png" && parsed.screenshotMimeType !== "image/jpeg") ||
      !Array.isArray(parsed.links)
    ) {
      return null;
    }

    const links = parsed.links
      .filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === "object")
      .map((value) => ({
        text: typeof value.text === "string" ? value.text : "",
        href: typeof value.href === "string" ? value.href : "",
      }))
      .filter((value) => value.href.length > 0)
      .slice(0, 12);

    return {
      title: parsed.title,
      finalUrl: parsed.finalUrl,
      textSnippet: parsed.textSnippet,
      contentSnippet: parsed.contentSnippet,
      links,
      screenshotBase64: parsed.screenshotBase64,
      screenshotMimeType: parsed.screenshotMimeType,
    };
  } catch {
    return null;
  }
}
