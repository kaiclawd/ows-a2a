import {
  resolveAgent,
  verifyAgent,
  getEnforcement,
  getUnifiedTrust,
  getFreeTierStatus,
  sendMessage,
  getStats,
  evaluateTrustGate,
  discoverAgents,
  STRICT_POLICY,
  BALANCED_POLICY,
  MARKETPLACE_POLICY,
  SUPPORTED_CHAINS,
} from "../src/index";

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║  SAID Protocol × OWS: Enforcement-Native A2A v2.0.0     ║");
  console.log("║  Identity + Staking/Slashing + x402 Messaging            ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log("");

  const testWallet = "4yNvqCyocbyqMVWQsztXaW5iZAsnb8wQy8Ghg58uSN9Q";

  // ── 1. Enforcement Data ──────────────────────────────
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("1. ECONOMIC ENFORCEMENT DATA (v2.0 NEW)");
  console.log("   Does this agent have skin in the game?");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");

  try {
    const enforcement = await getEnforcement(testWallet);
    if (enforcement) {
      console.log(`   Staked: ${enforcement.staked ? "YES" : "NO"}`);
      if (enforcement.stakeAmountSOL) {
        console.log(`   Stake: ${enforcement.stakeAmountSOL} SOL`);
      }
      console.log(`   Tier: ${enforcement.enforcementTier}`);
      console.log(`   Slashed: ${enforcement.slashed ? "YES" : "NO"}`);
      console.log(`   Slash count: ${enforcement.slashCount}`);
    } else {
      console.log("   No enforcement data (agent may not be staked)");
    }
  } catch (e: any) {
    console.log(`   (Enforcement unavailable: ${e.message})`);
  }
  console.log("");

  // ── 2. Unified Trust (Identity + Enforcement) ────────
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("2. UNIFIED TRUST VERDICT (Identity + Enforcement)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");

  try {
    const trust = await getUnifiedTrust(testWallet);
    console.log(`   Wallet: ${trust.wallet}`);
    console.log(`   Verdict: ${trust.verdict.toUpperCase()}`);
    console.log(`   Has skin in game: ${trust.hasSkinInGame ? "YES" : "NO"}`);
    console.log(`   Max tx value: $${trust.maxTxValueUSDC} USDC`);
    console.log(`   Recommended escrow: ${trust.recommendedEscrowPct}%`);
    console.log(`   Insight: ${trust.insight}`);
  } catch (e: any) {
    console.log(`   (Trust check unavailable: ${e.message})`);
  }
  console.log("");

  // ── 3. Enforcement-Aware Trust Gate ──────────────────
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("3. TRUST GATE: Can this agent send messages?");
  console.log("   (Now checking staking/slashing alongside identity)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");

  for (const [name, policy] of [
    ["MARKETPLACE", MARKETPLACE_POLICY],
    ["STRICT", STRICT_POLICY],
    ["BALANCED", BALANCED_POLICY],
  ] as const) {
    const gate = await evaluateTrustGate(testWallet, policy);
    console.log(`   ${name.padEnd(12)} ${gate.allowed ? "✅ ALLOWED" : "❌ DENIED"}`);
    if (!gate.allowed && gate.reason) {
      console.log(`   ${"".padEnd(12)} └─ ${gate.reason}`);
    }
    if (gate.enforcement) {
      console.log(`   ${"".padEnd(12)} └─ Staked: ${gate.enforcement.staked ? "YES" : "NO"}, Slashes: ${gate.enforcement.slashCount}`);
    }
  }
  console.log("");

  // ── 4. Agent Identity ────────────────────────────────
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("4. AGENT IDENTITY (SAID Registry)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");

  try {
    const agent = await verifyAgent(testWallet);
    if (agent) {
      console.log(`   Name: ${agent.name}`);
      console.log(`   Verified: ${agent.verified ? "YES" : "NO"}`);
      if (agent.trustScore) {
        console.log(`   Trust: ${agent.trustScore.score}/100 (${agent.trustScore.tier})`);
      }
    } else {
      console.log("   No SAID identity found");
    }
  } catch (e: any) {
    console.log(`   (Identity unavailable: ${e.message})`);
  }
  console.log("");

  // ── 5. Cross-Chain Stats ────────────────────────────
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("5. CROSS-CHAIN REGISTRY");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");

  try {
    const stats = await getStats();
    console.log(`   Total agents: ${stats.totalAgents}`);
    console.log(`   Chains: ${SUPPORTED_CHAINS.join(", ")}`);
  } catch (e: any) {
    console.log(`   (Stats unavailable: ${e.message})`);
  }
  console.log("");

  // ── Summary ──────────────────────────────────────────
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("OWS gives agents wallets.");
  console.log("SAID gives agents identity, enforcement, and communication.");
  console.log("");
  console.log("  ows-policy  → identity-gated SIGNING (spend limits)");
  console.log("  ows-a2a     → enforcement-gated COMMUNICATION (v2.0)");
  console.log("");
  console.log("v2.0: Now with staking/slashing integration —");
  console.log("agents with skin in the game get better messaging trust.");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main().catch(console.error);
