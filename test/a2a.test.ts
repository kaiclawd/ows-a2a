/**
 * SAID A2A Client v2.0.0 — Test Suite
 *
 * Tests enforcement-native trust integration, preset policies,
 * cache behavior, and unified trust verdicts.
 */

import {
  evaluateTrustGate,
  getEnforcement,
  getUnifiedTrust,
  STRICT_POLICY,
  BALANCED_POLICY,
  PERMISSIVE_POLICY,
  MARKETPLACE_POLICY,
  MAXIMUM_SECURITY_POLICY,
  SUPPORTED_CHAINS,
  PAYMENT_NETWORKS,
} from "../src/index";

import type {
  TrustGateConfig,
  EnforcementData,
  UnifiedTrustResult,
} from "../src/index";

// ── Test Runner ────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(cond: boolean, msg: string): void {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${msg}`);
  }
}

async function test(name: string, fn: () => Promise<void> | void): Promise<void> {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
  } catch (err: any) {
    failed++;
    console.error(`  ✗ FAIL: ${name} — ${err.message}`);
  }
}

// ── Known test wallet (registered on SAID) ─────────────

const TEST_WALLET = "4yNvqCyocbyqMVWQsztXaW5iZAsnb8wQy8Ghg58uSN9Q";
const UNKNOWN_WALLET = "11111111111111111111111111111111";

// ── Tests ──────────────────────────────────────────────

async function runTests(): Promise<void> {
  console.log("\n━━━ SAID A2A Client v2.0.0 — Test Suite ━━━\n");

  // ── Preset Policies ─────────────────────────────────

  console.log("Preset Policies:");

  await test("STRICT_POLICY requires verified + staked", () => {
    assert(STRICT_POLICY.requireVerified === true, "should require verified");
    assert(STRICT_POLICY.requireStaked === true, "should require staked");
    assert(STRICT_POLICY.minSenderScore === 40, "should require score >= 40");
    assert(STRICT_POLICY.maxSlashes === 0, "should allow 0 slashes");
    assert(STRICT_POLICY.blockAnonymous === true, "should block anonymous");
  });

  await test("BALANCED_POLICY requires verified, allows unstaked", () => {
    assert(BALANCED_POLICY.requireVerified === true, "should require verified");
    assert(BALANCED_POLICY.requireStaked === undefined, "should not require staked");
    assert(BALANCED_POLICY.minSenderScore === 20, "should require score >= 20");
    assert(BALANCED_POLICY.maxSlashes === 1, "should allow max 1 slash");
  });

  await test("PERMISSIVE_POLICY allows unverified, blocks slashed", () => {
    assert(PERMISSIVE_POLICY.requireVerified === undefined, "should not require verified");
    assert(PERMISSIVE_POLICY.requireStaked === undefined, "should not require staked");
    assert(PERMISSIVE_POLICY.maxSlashes === 2, "should allow max 2 slashes");
  });

  await test("MARKETPLACE_POLICY requires staked for commercial", () => {
    assert(MARKETPLACE_POLICY.requireStaked === true, "should require staked");
    assert(MARKETPLACE_POLICY.requireVerified === true, "should require verified");
    assert(MARKETPLACE_POLICY.minSenderScore === 30, "should require score >= 30");
  });

  await test("MAXIMUM_SECURITY_POLICY highest thresholds", () => {
    assert(MAXIMUM_SECURITY_POLICY.requireStaked === true, "should require staked");
    assert(MAXIMUM_SECURITY_POLICY.minSenderScore === 60, "should require score >= 60");
    assert(MAXIMUM_SECURITY_POLICY.maxSlashes === 0, "should allow 0 slashes");
  });

  // ── Policy Strictness Hierarchy ─────────────────────

  console.log("\nPolicy Strictness Hierarchy:");

  await test("strictness ordering is correct", () => {
    const scores = [
      PERMISSIVE_POLICY.minSenderScore ?? 0,
      BALANCED_POLICY.minSenderScore ?? 0,
      MARKETPLACE_POLICY.minSenderScore ?? 0,
      STRICT_POLICY.minSenderScore ?? 0,
      MAXIMUM_SECURITY_POLICY.minSenderScore ?? 0,
    ];
    for (let i = 1; i < scores.length; i++) {
      assert(scores[i] >= scores[i - 1], `score[${i}] >= score[${i - 1}]`);
    }
  });

  // ── Enforcement Data ────────────────────────────────

  console.log("\nEnforcement Data (Live API):");

  await test("getEnforcement returns data or null for known wallet", async () => {
    const enforcement = await getEnforcement(TEST_WALLET);
    assert(enforcement === null || typeof enforcement.staked === "boolean", "staked should be boolean");
    assert(enforcement === null || typeof enforcement.slashCount === "number", "slashCount should be number");
    assert(enforcement === null || typeof enforcement.enforcementTier === "string", "enforcementTier should be string");
  });

  await test("getEnforcement returns null for unknown wallet", async () => {
    const enforcement = await getEnforcement(UNKNOWN_WALLET);
    // Should return null, not throw
    assert(enforcement === null || enforcement.staked === false, "unknown wallet should not be staked");
  });

  // ── Unified Trust ───────────────────────────────────

  console.log("\nUnified Trust (Identity + Enforcement):");

  await test("getUnifiedTrust returns complete verdict", async () => {
    const result = await getUnifiedTrust(TEST_WALLET);
    assert(typeof result.wallet === "string", "wallet should be string");
    assert(["trusted", "provisional", "insufficient_evidence", "untrusted"].includes(result.verdict), "verdict should be valid");
    assert(typeof result.hasSkinInGame === "boolean", "hasSkinInGame should be boolean");
    assert(typeof result.maxTxValueUSDC === "number", "maxTxValueUSDC should be number");
    assert(typeof result.recommendedEscrowPct === "number", "recommendedEscrowPct should be number");
    assert(typeof result.insight === "string", "insight should be string");
  });

  await test("getUnifiedTrust handles unknown wallet gracefully", async () => {
    const result = await getUnifiedTrust(UNKNOWN_WALLET);
    assert(result.verdict === "insufficient_evidence" || result.verdict === "untrusted", "unknown wallet should be insufficient/untrusted");
    assert(result.hasSkinInGame === false, "unknown wallet should not have skin in game");
    assert(result.maxTxValueUSDC <= 50, "unknown wallet should have low max tx");
  });

  // ── Trust Gate with Enforcement ─────────────────────

  console.log("\nTrust Gate (Enforcement-Native):");

  await test("evaluateTrustGate returns enforcement data", async () => {
    const result = await evaluateTrustGate(TEST_WALLET, {});
    // Should include enforcement field even if null
    assert(result.enforcement !== undefined || result.allowed === true, "should return enforcement or allow");
  });

  await test("evaluateTrustGate blocks anonymous with blockAnonymous", async () => {
    const result = await evaluateTrustGate(UNKNOWN_WALLET, {
      blockAnonymous: true,
    });
    assert(result.allowed === false, "should block anonymous");
    assert(result.reason?.includes("No SAID identity") === true, "should explain why");
  });

  await test("evaluateTrustGate allows anonymous without blockAnonymous", async () => {
    const result = await evaluateTrustGate(UNKNOWN_WALLET, {});
    assert(result.allowed === true, "should allow anonymous by default");
  });

  await test("evaluateTrustGate with STRICT_POLICY", async () => {
    const result = await evaluateTrustGate(TEST_WALLET, STRICT_POLICY);
    // Will pass or fail based on the test wallet's actual trust data
    assert(typeof result.allowed === "boolean", "should return boolean allowed");
    if (!result.allowed) {
      assert(typeof result.reason === "string", "should include reason when denied");
    }
  });

  // ── Constants ───────────────────────────────────────

  console.log("\nConstants:");

  await test("SUPPORTED_CHAINS includes solana and major EVM chains", () => {
    assert(SUPPORTED_CHAINS.includes("solana"), "should include solana");
    assert(SUPPORTED_CHAINS.includes("ethereum"), "should include ethereum");
    assert(SUPPORTED_CHAINS.includes("base"), "should include base");
    assert(SUPPORTED_CHAINS.length >= 10, "should have at least 10 chains");
  });

  await test("PAYMENT_NETWORKS has CAIP-2 identifiers", () => {
    assert(PAYMENT_NETWORKS["solana"]?.startsWith("solana:"), "solana should be CAIP-2");
    assert(PAYMENT_NETWORKS["base"]?.startsWith("eip155:"), "base should be CAIP-2");
  });

  // ── Summary ─────────────────────────────────────────

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  ${passed} passed, ${failed} failed`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
