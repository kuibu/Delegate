import { artifactStoreConfigSchema } from "@delegate/artifacts";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4010),
  COMPUTE_BROKER_INTERNAL_TOKEN: z.string().min(1),
  COMPUTE_RUNNER_TYPE: z.enum(["docker", "vm"]).default("docker"),
  COMPUTE_RUNNER_IMAGE: z.string().min(1).default("debian:bookworm-slim"),
  COMPUTE_BROWSER_IMAGE: z.string().min(1).default("mcr.microsoft.com/playwright:v1.58.2-noble"),
  COMPUTE_BROWSER_PLAYWRIGHT_VERSION: z.string().min(1).default("1.58.2"),
  COMPUTE_BROWSER_MAX_COMMAND_SECONDS: z.coerce.number().int().positive().default(120),
  COMPUTE_NATIVE_OPENAI_ENABLED: z.string().optional(),
  COMPUTE_NATIVE_OPENAI_MODEL: z.string().optional(),
  COMPUTE_NATIVE_ANTHROPIC_ENABLED: z.string().optional(),
  COMPUTE_NATIVE_ANTHROPIC_MODEL: z.string().optional(),
  COMPUTE_MCP_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  COMPUTE_HOST_WORKSPACE_ROOT: z.string().min(1).default("/Users/a/repos/Delegate"),
  ARTIFACT_STORE_ENDPOINT: z.string().url().default("http://artifact-store:9000"),
  ARTIFACT_STORE_BUCKET: z.string().min(1).default("delegate-compute-artifacts"),
  ARTIFACT_STORE_ACCESS_KEY: z.string().min(1).default("delegate"),
  ARTIFACT_STORE_SECRET_KEY: z.string().min(1).default("delegate-secret-key"),
  ARTIFACT_STORE_REGION: z.string().min(1).default("us-east-1"),
});

const parsed = envSchema.parse(process.env);

export const computeBrokerConfig = {
  port: parsed.PORT,
  internalToken: parsed.COMPUTE_BROKER_INTERNAL_TOKEN,
  runnerType: parsed.COMPUTE_RUNNER_TYPE,
  runnerImage: parsed.COMPUTE_RUNNER_IMAGE,
  browserImage: parsed.COMPUTE_BROWSER_IMAGE,
  browserPlaywrightVersion: parsed.COMPUTE_BROWSER_PLAYWRIGHT_VERSION,
  browserMaxCommandSeconds: parsed.COMPUTE_BROWSER_MAX_COMMAND_SECONDS,
  nativeComputerUse: {
    openai: {
      enabled: parseBoolean(parsed.COMPUTE_NATIVE_OPENAI_ENABLED, true),
      ...(normalizeOptionalString(parsed.COMPUTE_NATIVE_OPENAI_MODEL)
        ? { model: normalizeOptionalString(parsed.COMPUTE_NATIVE_OPENAI_MODEL) }
        : {}),
    },
    anthropic: {
      enabled: parseBoolean(parsed.COMPUTE_NATIVE_ANTHROPIC_ENABLED, true),
      ...(normalizeOptionalString(parsed.COMPUTE_NATIVE_ANTHROPIC_MODEL)
        ? { model: normalizeOptionalString(parsed.COMPUTE_NATIVE_ANTHROPIC_MODEL) }
        : {}),
    },
  },
  mcpTimeoutMs: parsed.COMPUTE_MCP_TIMEOUT_MS,
  hostWorkspaceRoot: parsed.COMPUTE_HOST_WORKSPACE_ROOT,
  artifactStore: artifactStoreConfigSchema.parse({
    endpoint: parsed.ARTIFACT_STORE_ENDPOINT,
    bucket: parsed.ARTIFACT_STORE_BUCKET,
    accessKeyId: parsed.ARTIFACT_STORE_ACCESS_KEY,
    secretAccessKey: parsed.ARTIFACT_STORE_SECRET_KEY,
    region: parsed.ARTIFACT_STORE_REGION,
    forcePathStyle: true,
  }),
};

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
