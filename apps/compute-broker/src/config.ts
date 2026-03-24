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
