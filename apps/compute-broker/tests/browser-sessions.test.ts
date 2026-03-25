import { describe, expect, it } from "vitest";

import {
  deriveBrowserSessionCloseState,
  deriveBrowserSessionPersistence,
} from "../src/browser-sessions";

describe("deriveBrowserSessionPersistence", () => {
  it("preserves the last known good location when a navigation fails before reaching the target", () => {
    const result = deriveBrowserSessionPersistence({
      existing: {
        status: "ACTIVE",
        currentUrl: "https://example.com/",
        currentTitle: "Example Domain",
        failureReason: null,
      },
      navigation: {
        requestedUrl: "https://broken.example/",
        status: "failed",
        errorMessage: "network timeout",
      },
    });

    expect(result).toEqual({
      status: "FAILED",
      currentUrl: "https://example.com/",
      currentTitle: "Example Domain",
      failureReason: "network timeout",
    });
  });

  it("updates the current location when a navigation succeeds", () => {
    const result = deriveBrowserSessionPersistence({
      existing: {
        status: "FAILED",
        currentUrl: "https://example.com/",
        currentTitle: "Example Domain",
        failureReason: "old failure",
      },
      navigation: {
        requestedUrl: "https://example.org/",
        finalUrl: "https://example.org/",
        pageTitle: "Example Domain",
        status: "succeeded",
      },
    });

    expect(result).toEqual({
      status: "ACTIVE",
      currentUrl: "https://example.org/",
      currentTitle: "Example Domain",
      failureReason: null,
    });
  });
});

describe("deriveBrowserSessionCloseState", () => {
  it("keeps failure reasons only for genuinely failed sessions", () => {
    expect(
      deriveBrowserSessionCloseState({
        existing: {
          status: "FAILED",
          failureReason: "page crashed",
        },
      }),
    ).toEqual({
      status: "FAILED",
      failureReason: "page crashed",
    });
  });

  it("does not turn normal termination reasons into failure state", () => {
    expect(
      deriveBrowserSessionCloseState({
        existing: {
          status: "ACTIVE",
          failureReason: null,
        },
      }),
    ).toEqual({
      status: "CLOSED",
      failureReason: null,
    });
  });
});
