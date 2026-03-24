import { describe, expect, it } from "vitest";

import { buildDockerRunArgs } from "../src/runner";

describe("buildDockerRunArgs", () => {
  it("isolates the runner with no network and a read-only workspace", () => {
    const args = buildDockerRunArgs({
      image: "debian:bookworm-slim",
      command: "pwd",
      hostWorkspaceRoot: "/Users/a/repos/Delegate",
      maxCommandSeconds: 30,
      networkMode: "no_network",
      filesystemMode: "read_only_workspace",
      sessionId: "session_1234567890",
      executionId: "execution_1234567890",
    });

    expect(args).toContain("--network");
    expect(args).toContain("none");
    expect(args).toContain("--read-only");
    expect(args).toContain("/Users/a/repos/Delegate:/workspace:ro");
    expect(args.slice(-3)).toEqual(["debian:bookworm-slim", "sh", "-lc", "pwd"].slice(-3));
  });

  it("keeps an ephemeral workspace when the policy allows a full sandbox", () => {
    const args = buildDockerRunArgs({
      image: "debian:bookworm-slim",
      command: "pwd",
      hostWorkspaceRoot: "/Users/a/repos/Delegate",
      maxCommandSeconds: 30,
      networkMode: "full",
      filesystemMode: "ephemeral_full",
      sessionId: "session_1234567890",
      executionId: "execution_1234567890",
      workingDirectory: "ignored",
    });

    expect(args).not.toContain("--volume");
    expect(args).toContain("--workdir");
    expect(args).toContain("/tmp");
  });
});
