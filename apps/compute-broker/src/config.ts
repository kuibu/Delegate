import { artifactStoreConfigSchema } from "@delegate/artifacts";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4010),
  COMPUTE_BROKER_INTERNAL_TOKEN: z.string().min(1),
  COMPUTE_RUNNER_TYPE: z.enum(["docker", "vm"]).default("docker"),
  COMPUTE_RUNNER_IMAGE: z.string().min(1).default("debian:bookworm-slim"),
  COMPUTE_BROWSER_IMAGE: z.string().min(1).default("delegate-app:local"),
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
