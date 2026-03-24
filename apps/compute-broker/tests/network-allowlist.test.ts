import { describe, expect, it } from "vitest";

import {
  extractHostname,
  isHostnameAllowed,
  normalizeNetworkAllowlist,
} from "../src/network-allowlist";

describe("network allowlist helpers", () => {
  it("normalizes hostnames and wildcard entries", () => {
    expect(
      normalizeNetworkAllowlist([
        "API.EXAMPLE.COM",
        " https://tools.example.com/path ",
        "*.Trusted.Tools",
        "api.example.com",
      ]),
    ).toEqual(["api.example.com", "tools.example.com", "*.trusted.tools"]);
  });

  it("matches exact and wildcard hostnames", () => {
    const allowlist = ["api.example.com", "*.trusted.tools"];

    expect(isHostnameAllowed("api.example.com", allowlist)).toBe(true);
    expect(isHostnameAllowed("worker.trusted.tools", allowlist)).toBe(true);
    expect(isHostnameAllowed("trusted.tools", allowlist)).toBe(false);
    expect(isHostnameAllowed("evil.example.com", allowlist)).toBe(false);
  });

  it("extracts hostnames from URLs", () => {
    expect(extractHostname("https://api.example.com/v1/tools")).toBe("api.example.com");
    expect(extractHostname("worker.trusted.tools")).toBe("worker.trusted.tools");
    expect(extractHostname("")).toBeNull();
  });
});
