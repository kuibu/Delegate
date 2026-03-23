import { describe, expect, it } from "vitest";

import {
  ClawHubRequestError,
  fetchClawHubRepresentativeSkill,
  resolveClawHubBaseUrl,
  searchClawHubRepresentativeSkills,
} from "../src/index";

describe("resolveClawHubBaseUrl", () => {
  it("uses the default registry URL", () => {
    expect(resolveClawHubBaseUrl()).toBe("https://clawhub.ai");
  });

  it("normalizes trailing slashes", () => {
    expect(resolveClawHubBaseUrl("https://clawhub.ai/")).toBe("https://clawhub.ai");
  });
});

describe("searchClawHubRepresentativeSkills", () => {
  it("maps search results into non-privileged skill packs", async () => {
    const results = await searchClawHubRepresentativeSkills({
      query: "qualification",
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            results: [
              {
                score: 0.88,
                slug: "lead-qualification-pro",
                displayName: "Lead Qualification Pro",
                summary: "Collects structured lead intake.",
                version: "0.3.0",
              },
            ],
          }),
        ),
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.source).toBe("clawhub");
    expect(results[0]?.enabled).toBe(false);
    expect(results[0]?.executesCode).toBe(false);
  });

  it("falls back to list mode when no search query is provided", async () => {
    const results = await searchClawHubRepresentativeSkills({
      query: "",
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            items: [
              {
                slug: "founder-faq",
                displayName: "Founder FAQ",
                summary: "Answers frequent founder questions.",
                latestVersion: {
                  version: "1.2.0",
                  createdAt: 2,
                },
                createdAt: 1,
                updatedAt: 2,
              },
            ],
          }),
        ),
    });

    expect(results[0]?.slug).toBe("founder-faq");
    expect(results[0]?.version).toBe("1.2.0");
  });
});

describe("fetchClawHubRepresentativeSkill", () => {
  it("hydrates a skill pack from detail metadata", async () => {
    const skill = await fetchClawHubRepresentativeSkill({
      slug: "lead-qualification-pro",
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            skill: {
              slug: "lead-qualification-pro",
              displayName: "Lead Qualification Pro",
              summary: "Collects structured lead intake.",
              tags: {
                verified: "true",
                intake: "true",
              },
              createdAt: 1,
              updatedAt: 2,
            },
            latestVersion: {
              version: "0.3.0",
              createdAt: 2,
            },
            owner: {
              handle: "community-builder",
            },
          }),
        ),
    });

    expect(skill?.slug).toBe("lead-qualification-pro");
    expect(skill?.verificationTier).toBe("verified");
    expect(skill?.capabilityTags).toEqual(["intake", "verified"]);
  });

  it("throws a typed request error on non-200 responses", async () => {
    await expect(
      fetchClawHubRepresentativeSkill({
        slug: "missing",
        fetchImpl: async () => new Response("nope", { status: 404, statusText: "Not Found" }),
      }),
    ).rejects.toBeInstanceOf(ClawHubRequestError);
  });
});
