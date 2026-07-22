/**
 * Discovery Demo — Browse the SAID agent directory
 *
 * Run: npm run demo:discover
 */

import { discoverAgents, getStats, getChains } from "../src";

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║  SAID Protocol: Agent Discovery Demo                      ║");
  console.log("║  Browse the cross-chain agent directory                    ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log("");

  // ── 1. Registry Stats ────────────────────────────────
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("REGISTRY STATS");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  try {
    const stats = await getStats();
    console.log(`  Total agents: ${stats.totalAgents}`);
    console.log(`  Total chains: ${stats.totalChains}`);
    for (const [chain, info] of Object.entries(stats.chains)) {
      console.log(`  ${chain}: ${info.agents} agents (${info.source})`);
    }
  } catch (e: unknown) {
    console.log(`  (Stats unavailable: ${(e as Error).message})`);
  }
  console.log("");

  // ── 2. Supported Chains ──────────────────────────────
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("SUPPORTED CHAINS");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  try {
    const chains = await getChains();
    console.log(`  ${chains.count} chains: ${chains.chains.join(", ")}`);
  } catch (e: unknown) {
    console.log(`  (Chains unavailable: ${(e as Error).message})`);
  }
  console.log("");

  // ── 3. Discover Verified Agents ──────────────────────
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("DISCOVER VERIFIED AGENTS");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  try {
    const result = await discoverAgents({ verified: true, limit: 20 });
    console.log(`  Found ${result.count} verified agents\n`);

    for (const agent of result.agents.slice(0, 20)) {
      const name = (agent.name || "Unnamed").substring(0, 25);
      const verified = agent.verified ? "✓" : " ";
      const score = agent.reputationScore.toString().padStart(3);
      const chain = agent.chain.padEnd(10);
      console.log(`  ${verified} ${name.padEnd(27)} ${chain} score=${score}`);
    }
  } catch (e: unknown) {
    console.log(`  (Discovery unavailable: ${(e as Error).message})`);
  }
  console.log("");

  // ── 4. Discover All Agents (including unverified) ───
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("DISCOVER ALL AGENTS");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  try {
    const result = await discoverAgents({ limit: 20 });
    console.log(`  Found ${result.count} agents\n`);

    const verified = result.agents.filter((a) => a.verified).length;
    const unverified = result.count - verified;
    console.log(`  Verified: ${verified} (${Math.round((verified / Math.max(result.count, 1)) * 100)}%)`);
    console.log(`  Unverified: ${unverified}`);
  } catch (e: unknown) {
    console.log(`  (Discovery unavailable: ${(e as Error).message})`);
  }
  console.log("");

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Done. Register your agent at saidprotocol.com");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main().catch(console.error);
