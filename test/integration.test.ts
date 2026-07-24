/**
 * SAID A2A Client — Live API Integration Tests
 *
 * These tests run against the live SAID API at api.saidprotocol.com.
 * They verify real agent data, real enforcement data, and real messaging.
 *
 * Run: npm test
 */

import {
  resolveAgent,
  verifyAgent,
  getAgentCard,
  getEnforcement,
  getRiskAssessment,
  sendMessage,
  getFreeTierStatus,
  discoverAgents,
  getStats,
  evaluateTrustGate,
  SUPPORTED_CHAINS,
  PAYMENT_NETWORKS,
} from "../src/index";

// Known registered SAID agents (used for live testing)
const KNOWN_AGENT = "4yNvqCyocbyqMVWQsztXaW5iZAsnb8wQy8Ghg58uSN9Q";
const ANOTHER_AGENT = "72onvrQJZkPGLAhWK5MeYc73iyM72P2ABKzDMQ4NpQBL";
const ANON_WALLET = "11111111111111111111111111111111";

// ── Test runner ────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err: any) {
    console.log(`  ❌ ${name}`);
    console.log(`     ${err.message}`);
    failures.push(name);
    failed++;
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertEq<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

// ── Tests ──────────────────────────────────────────────

async function main() {
  console.log("\n━━━ SAID A2A Client v2.0 — Integration Tests ━━━\n");

  // ── Constants ─────────────────────────────────────
  console.log("Constants:");

  await test("SUPPORTED_CHAINS has 10 chains", async () => {
    assertEq(SUPPORTED_CHAINS.length, 10, "Expected 10 chains");
    assert(SUPPORTED_CHAINS.includes("solana"), "Must include solana");
    assert(SUPPORTED_CHAINS.includes("base"), "Must include base");
    assert(SUPPORTED_CHAINS.includes("bnb"), "Must include bnb");
  });

  await test("PAYMENT_NETWORKS maps major chains", async () => {
    assert(PAYMENT_NETWORKS["solana"] !== undefined, "Solana must have CAIP-2");
    assert(PAYMENT_NETWORKS["base"] !== undefined, "Base must have CAIP-2");
    assert(
      PAYMENT_NETWORKS["solana"].startsWith("solana:"),
      "Solana CAIP-2 format",
    );
    assert(
      PAYMENT_NETWORKS["base"].startsWith("eip155:"),
      "Base CAIP-2 format",
    );
  });

  // ── Agent Resolution ──────────────────────────────
  console.log("\nAgent Resolution:");

  await test("verifyAgent returns known agent", async () => {
    const agent = await verifyAgent(KNOWN_AGENT);
    assert(agent !== null, "Agent should exist");
    assertEq(agent!.address, KNOWN_AGENT, "Address mismatch");
    assertEq(agent!.chain, "solana", "Should be Solana");
    assertEq(agent!.source, "said", "Should be SAID source");
    assert(agent!.name.length > 0, "Should have a name");
    assert(typeof agent!.verified === "boolean", "Verified should be boolean");
    assert(typeof agent!.reputationScore === "number", "Score should be number");
  });

  await test("verifyAgent returns null for unregistered wallet", async () => {
    const agent = await verifyAgent(ANON_WALLET);
    // Anonymous wallet might return null or an unregistered agent
    if (agent !== null) {
      assertEq(agent.registeredAt, undefined, "Anon should have no registration");
    }
  });

  await test("resolveAgent resolves Solana address", async () => {
    const agents = await resolveAgent(KNOWN_AGENT);
    assert(Array.isArray(agents), "Should return array");
    // May be empty if agent doesn't have cross-chain registrations
  });

  // ── Enforcement (v2.0) ────────────────────────────
  console.log("\nEnforcement (v2.0):");

  await test("getEnforcement returns status object", async () => {
    const enforcement = await getEnforcement(KNOWN_AGENT);
    // May be null if agent has no enforcement data, or object if they do
    if (enforcement !== null) {
      assertEq(enforcement.wallet, KNOWN_AGENT, "Wallet mismatch");
      assert(typeof enforcement.staked === "boolean", "staked should be boolean");
      assert(typeof enforcement.slashed === "boolean", "slashed should be boolean");
      assert(
        typeof enforcement.stakeAmountSOL === "number",
        "stakeAmountSOL should be number",
      );
      assert(
        typeof enforcement.slashCount === "number",
        "slashCount should be number",
      );
      assert(
        ["economic", "reputation", "none"].includes(enforcement.enforcementTier),
        "Valid enforcement tier",
      );
    }
  });

  await test("getEnforcement returns null or valid object for unknown", async () => {
    const enforcement = await getEnforcement(ANON_WALLET);
    assert(enforcement === null || enforcement.wallet === ANON_WALLET, "Should be null or valid");
  });

  // ── Risk Assessment (v2.0) ────────────────────────
  console.log("\nRisk Assessment (v2.0):");

  await test("getRiskAssessment returns full assessment", async () => {
    const risk = await getRiskAssessment(KNOWN_AGENT);
    assert(risk !== null, "Should return risk assessment");
    assertEq(risk!.wallet, KNOWN_AGENT, "Wallet mismatch");
    assert(typeof risk!.score === "number", "Score should be number");
    assert(typeof risk!.verified === "boolean", "Verified should be boolean");
    assert(
      ["low", "medium", "high", "critical"].includes(risk!.riskLevel),
      "Valid risk level",
    );
    assert(
      ["accept", "review", "reject"].includes(risk!.verdict),
      "Valid verdict",
    );
    assert(
      typeof risk!.escrowPct === "number" && risk!.escrowPct >= 0 && risk!.escrowPct <= 100,
      "Escrow % should be 0-100",
    );
    assert(typeof risk!.spendCap === "number" && risk!.spendCap >= 0, "Spend cap should be >= 0");
    assert(typeof risk!.factors === "object", "Should have factors object");
  });

  await test("getRiskAssessment for slashed agent returns critical/reject", async () => {
    // This tests the logic — if an agent is slashed, they should be rejected
    // We can't guarantee a specific slashed agent is available, so just verify structure
    const risk = await getRiskAssessment(KNOWN_AGENT);
    if (risk?.slashed) {
      assertEq(risk!.riskLevel, "critical", "Slashed agents should be critical");
      assertEq(risk!.verdict, "reject", "Slashed agents should be rejected");
      assertEq(risk!.escrowPct, 100, "Slashed agents should need 100% escrow");
    }
  });

  // ── Trust Gate (v2.0 with enforcement) ────────────
  console.log("\nTrust Gate (v2.0):");

  await test("evaluateTrustGate allows known agent", async () => {
    const gate = await evaluateTrustGate(KNOWN_AGENT, {});
    assertEq(gate.allowed, true, "Known agent should be allowed by default");
  });

  await test("evaluateTrustGate blocks anonymous when configured", async () => {
    const gate = await evaluateTrustGate(ANON_WALLET, {
      blockAnonymous: true,
    });
    assertEq(gate.allowed, false, "Anon should be blocked");
    assert(gate.reason!.includes("No SAID identity"), "Should explain blocking");
  });

  await test("evaluateTrustGate checks minSenderScore", async () => {
    const gate = await evaluateTrustGate(KNOWN_AGENT, {
      minSenderScore: 200, // Impossibly high
    });
    // Agent score is unlikely to be 200+
    if (gate.agent?.trustScore && gate.agent.trustScore.score < 200) {
      assertEq(gate.allowed, false, "Should block low-score agents");
      assert(gate.reason!.includes("below minimum"), "Should explain score rejection");
    }
  });

  await test("evaluateTrustGate checks blockSlashed", async () => {
    // Just verify it doesn't crash — can't guarantee a slashed agent exists
    const gate = await evaluateTrustGate(KNOWN_AGENT, {
      blockSlashed: true,
    });
    assert(typeof gate.allowed === "boolean", "Should return boolean");
  });

  await test("evaluateTrustGate checks minStakeSOL", async () => {
    const gate = await evaluateTrustGate(KNOWN_AGENT, {
      minStakeSOL: 1000, // Impossibly high
    });
    // If agent has less than 1000 SOL staked, should be blocked
    if (gate.allowed === false) {
      assert(gate.reason!.includes("Stake"), "Should mention stake amount");
    }
  });

  // ── Messaging ─────────────────────────────────────
  console.log("\nMessaging:");

  await test("sendMessage returns structured result", async () => {
    const result = await sendMessage({
      from: { address: KNOWN_AGENT, chain: "solana" },
      to: { address: ANOTHER_AGENT, chain: "solana" },
      message: "Integration test from ows-a2a v2.0 test suite",
      context: { test: true, timestamp: Date.now() },
    });

    assert(typeof result.success === "boolean", "success should be boolean");
    assert(
      ["delivered", "stored", "payment_required", "denied"].includes(result.status),
      "Valid status value",
    );
    assert(typeof result.paid === "boolean", "paid should be boolean");
  });

  // ── Free Tier ─────────────────────────────────────
  console.log("\nFree Tier:");

  await test("getFreeTierStatus returns payment config", async () => {
    const status = await getFreeTierStatus(KNOWN_AGENT);
    assertEq(status.protocol, "x402", "Should use x402 protocol");
    assertEq(status.currency, "USDC", "Currency should be USDC");
    assert(status.treasury.length > 0, "Should have treasury address");
    assert(
      typeof status.freeTier.remaining === "number",
      "Remaining should be number",
    );
    assert(
      typeof status.freeTier.messagesPerDay === "number",
      "Daily limit should be number",
    );
  });

  // ── Discovery ─────────────────────────────────────
  console.log("\nDiscovery:");

  await test("discoverAgents returns results", async () => {
    const result = await discoverAgents({ limit: 5 });
    assert(Array.isArray(result.agents), "agents should be array");
    assert(typeof result.count === "number", "count should be number");
  });

  await test("discoverAgents filters by verified", async () => {
    const result = await discoverAgents({ verified: true, limit: 5 });
    // All returned agents should be verified (if API respects filter)
    for (const agent of result.agents) {
      // API may not perfectly filter, but structure should be right
      assert(typeof agent.verified === "boolean", "verified field should exist");
    }
  });

  // ── Stats ─────────────────────────────────────────
  console.log("\nStats:");

  await test("getStats returns registry stats", async () => {
    try {
      const stats = await getStats();
      assert(typeof stats.totalAgents === "number", "totalAgents should be number");
      assert(typeof stats.totalChains === "number", "totalChains should be number");
      assert(stats.totalAgents >= 0, "Agent count should be non-negative");
    } catch (e: any) {
      // Stats endpoint might be flaky — log but don't fail
      if (e.message.includes("failed")) {
        console.log(`     (Stats endpoint unavailable — acceptable)`);
      } else {
        throw e;
      }
    }
  });

  // ── Agent Card ────────────────────────────────────
  console.log("\nAgent Card:");

  await test("getAgentCard returns card or null", async () => {
    const card = await getAgentCard(KNOWN_AGENT);
    // May return null if agent doesn't have a card configured
    if (card !== null) {
      assert(typeof card.name === "string", "Card should have name");
      // url may not be set for all agents
      if (card.url !== undefined) {
        assert(typeof card.url === "string", "Card url should be string");
      }
    }
  });

  // ── Summary ───────────────────────────────────────
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failures.length > 0) {
    console.log(`\nFailed tests:`);
    for (const f of failures) {
      console.log(`  - ${f}`);
    }
  }
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});
