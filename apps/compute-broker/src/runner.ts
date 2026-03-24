import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { ComputeFilesystemMode, ComputeNetworkMode } from "@delegate/compute-protocol";

const execFileAsync = promisify(execFile);

export type DockerExecutionInput = {
  image: string;
  command: string;
  hostWorkspaceRoot: string;
  maxCommandSeconds: number;
  networkMode: ComputeNetworkMode;
  filesystemMode: ComputeFilesystemMode;
  workingDirectory?: string | null | undefined;
  sessionId: string;
  executionId: string;
};

export type DockerExecutionResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
  wallMs: number;
  containerName: string;
};

export function buildDockerRunArgs(input: DockerExecutionInput): string[] {
  const containerName = buildContainerName(input.sessionId, input.executionId);
  const args = [
    "run",
    "--rm",
    "--name",
    containerName,
    "--pids-limit",
    "128",
    "--memory",
    "256m",
    "--cpus",
    "1",
    "--read-only",
    "--tmpfs",
    "/tmp:rw,noexec,nosuid,size=64m",
  ];

  if (input.networkMode === "no_network") {
    args.push("--network", "none");
  }

  const workspaceMode = normalizeFilesystemMode(input.filesystemMode);
  if (workspaceMode !== "ephemeral_full") {
    args.push(
      "--volume",
      `${input.hostWorkspaceRoot}:/workspace:${workspaceMode === "workspace_only" ? "rw" : "ro"}`,
    );
    args.push("--workdir", normalizeWorkingDirectory(input.workingDirectory));
  } else {
    args.push("--workdir", "/tmp");
  }

  args.push(input.image, "sh", "-lc", input.command);
  return args;
}

export async function runDockerExecution(
  input: DockerExecutionInput,
): Promise<DockerExecutionResult> {
  const startedAt = Date.now();
  const args = buildDockerRunArgs(input);
  const containerName = buildContainerName(input.sessionId, input.executionId);

  try {
    const { stdout, stderr } = await execFileAsync("docker", args, {
      timeout: input.maxCommandSeconds * 1000,
      maxBuffer: 1024 * 1024,
    });

    return {
      exitCode: 0,
      stdout,
      stderr,
      wallMs: Date.now() - startedAt,
      containerName,
    };
  } catch (error) {
    const exitCode =
      typeof (error as { code?: unknown }).code === "number"
        ? (error as { code: number }).code
        : (error as { killed?: boolean }).killed
          ? 124
          : 1;

    return {
      exitCode,
      stdout: String((error as { stdout?: string }).stdout ?? ""),
      stderr: String((error as { stderr?: string }).stderr ?? (error instanceof Error ? error.message : "")),
      wallMs: Date.now() - startedAt,
      containerName,
    };
  }
}

function normalizeWorkingDirectory(value: string | null | undefined): string {
  if (!value) {
    return "/workspace";
  }

  const normalized = value.startsWith("/") ? value : `/workspace/${value}`;
  return normalized.startsWith("/workspace") ? normalized : "/workspace";
}

function normalizeFilesystemMode(mode: ComputeFilesystemMode) {
  switch (mode) {
    case "workspace_only":
      return "workspace_only";
    case "ephemeral_full":
      return "ephemeral_full";
    case "read_only_workspace":
    default:
      return "read_only_workspace";
  }
}

function buildContainerName(sessionId: string, executionId: string) {
  return `delegate-${sessionId.slice(0, 12)}-${executionId.slice(0, 12)}`;
}
