import { searchClawHubRepresentativeSkills } from "../packages/registry/src/index.ts";

void main();

async function main(): Promise<void> {
  const query = process.argv.slice(2).join(" ").trim();

  const results = await searchClawHubRepresentativeSkills({
    query,
    limit: 8,
  });

  if (results.length === 0) {
    console.log("No ClawHub representative skill candidates found.");
    return;
  }

  for (const result of results) {
    const version = result.version ? ` v${result.version}` : "";
    const owner = result.ownerHandle ? ` @${result.ownerHandle}` : "";
    console.log(`${result.slug}${version}${owner}`);
    console.log(`  ${result.displayName}`);
    console.log(`  ${result.summary}`);
    console.log(`  source=${result.source} verification=${result.verificationTier ?? "unknown"}`);
  }
}
