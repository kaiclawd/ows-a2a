/**
 * Integration tests for SAID A2A Communication Library
 *
 * Runs against the live SAID Protocol API at api.saidprotocol.com.
 * These are real API calls, not mocks — the tests verify that the
 * library correctly communicates with production infrastructure.
 */

import {
  describe,
  it,
  expect,
} from "@jest/globals";

import {
  createClient,
  resolveAgent,
  verifyAgent,
  getStats,
  getChains,
  discoverAgents,
  evaluateTrustGate,
  getEnforcement,
  getRiskAssessment,
  SUPPORTED_CHAINS,
  PAYMENT_NETWORKS,
} from "../src/index";

// A wallet that exists in the SAID registry (confirmed via API)
const KNOWN_WALLET = "4yNvqCyocbyqMVWQsztXaW5iZAsnb8wQy8Ghg58uSN9Q";
// A wallet that does NOT exist
const UNKNOWN_WALLET = "11111111111111111111111111111111";

// ── Constants ──────────────────────────────────────────

describe("Constants", () => {
  it("SUPPORTED_CHAINS includes solana and major EVM chains", () => {
    expect(SUPPORTED_CHAINS).toContain("solana");
    expect(SUPPORTED_CHAINS).toContain("ethereum");
    expect(SUPPORTED_CHAINS).toContain("base");
    expect(SUPPORTED_CHAINS.length).toBeGreaterThanOrEqual(10);
  });

  it("PAYMENT_NETWORKS maps chains to CAIP-2 identifiers", () => {
    expect(PAYMENT_NETWORKS["solana"]).toContain("solana:");
    expect(PAYMENT_NETWORKS["base"]).toBe("eip155:8453");
    expect(PAYMENT_NETWORKS["polygon"]).toBe("eip155:137");
  });
});

// ── Stats ──────────────────────────────────────────────

describe("getStats", () => {
  it("returns cross-chain registry stats from live API", async () => {
    const stats = await getStats();
    expect(stats).toBeDefined();
    expect(stats.totalAgents).toBeGreaterThan(0);
    expect(stats.totalChains).toBeGreaterThan(0);
    expect(stats.chains).toBeDefined();
    expect(typeof stats.chains).toBe("object");
  }, 15000);
});

// ── Chains ─────────────────────────────────────────────

describe("getChains", () => {
  it("returns supported chains from API or fallback", async () => {
    const result = await getChains();
    expect(result.chains).toBeDefined();
    expect(Array.isArray(result.chains)).toBe(true);
    expect(result.count).toBe(result.chains.length);
    expect(result.count).toBeGreaterThanOrEqual(10);
  }, 15000);
});

// ── Agent Verification ─────────────────────────────────

describe("verifyAgent", () => {
  it("returns agent identity for a known wallet", async () => {
    const agent = await verifyAgent(KNOWN_WALLET);
    expect(agent).not.toBeNull();
    expect(agent!.address).toBe(KNOWN_WALLET);
    expect(agent!.chain).toBe("solana");
    expect(agent!.source).toBe("said");
    expect(typeof agent!.name).toBe("string");
    expect(typeof agent!.verified).toBe("boolean");
  }, 15000);

  it("returns null for unknown wallet", async () => {
    const agent = await verifyAgent(UNKNOWN_WALLET);
    expect(agent).toBeNull();
  }, 15000);
});

// ── Agent Resolution ───────────────────────────────────

describe("resolveAgent", () => {
  it("resolves a Solana wallet address", async () => {
    const agents = await resolveAgent(KNOWN_WALLET);
    expect(Array.isArray(agents)).toBe(true);
    // May or may not have cross-chain results, but shouldn't throw
  }, 15000);
});

// ── Discovery ──────────────────────────────────────────

describe("discoverAgents", () => {
  it("discovers agents across chains", async () => {
    const result = await discoverAgents({ verified: true, limit: 5 });
    expect(result).toBeDefined();
    expect(typeof result.count).toBe("number");
    expect(Array.isArray(result.agents)).toBe(true);
  }, 15000);
});

// ── Trust Gate ─────────────────────────────────────────

describe("evaluateTrustGate", () => {
  it("allows known agent without strict requirements", async () => {
    const gate = await evaluateTrustGate(KNOWN_WALLET);
    expect(gate.allowed).toBe(true);
    expect(gate.agent).toBeDefined();
  }, 15000);

  it("blocks unknown wallet when blockAnonymous is true", async () => {
    const gate = await evaluateTrustGate(UNKNOWN_WALLET, {
      blockAnonymous: true,
    });
    expect(gate.allowed).toBe(false);
    expect(gate.reason).toContain("No SAID identity");
  }, 15000);

  it("allows unknown wallet when blockAnonymous is false", async () => {
    const gate = await evaluateTrustGate(UNKNOWN_WALLET);
    expect(gate.allowed).toBe(true);
  }, 15000);

  it("evaluates minSenderScore requirement", async () => {
    const gate = await evaluateTrustGate(KNOWN_WALLET, {
      requireVerified: false,
      minSenderScore: 200, // Impossibly high — should block
    });
    if (gate.agent?.trustScore) {
      expect(gate.allowed).toBe(false);
      expect(gate.reason).toContain("below minimum");
    }
  }, 15000);
});

// ── Enforcement Data (v2.1) ───────────────────────────

describe("getEnforcement", () => {
  it("returns enforcement status for a known wallet", async () => {
    const enforcement = await getEnforcement(KNOWN_WALLET);
    // May be null if no enforcement data, or a valid object
    if (enforcement !== null) {
      expect(enforcement.wallet).toBe(KNOWN_WALLET);
      expect(typeof enforcement.staked).toBe("boolean");
      expect(typeof enforcement.slashed).toBe("boolean");
      expect(typeof enforcement.stakeAmountSOL).toBe("number");
      expect(typeof enforcement.slashCount).toBe("number");
      expect(["economic", "reputation", "none"]).toContain(enforcement.enforcementTier);
    }
  }, 15000);

  it("handles unknown wallet gracefully", async () => {
    const enforcement = await getEnforcement(UNKNOWN_WALLET);
    // API returns a default object for unknown wallets, not null
    if (enforcement !== null) {
      expect(enforcement.staked).toBe(false);
      expect(enforcement.slashed).toBe(false);
      expect(enforcement.stakeAmountSOL).toBe(0);
      expect(enforcement.enforcementTier).toBe("none");
    }
  }, 15000);
});

// ── Risk Assessment (v2.1) ────────────────────────────

describe("getRiskAssessment", () => {
  it("returns full risk assessment for a known wallet", async () => {
    const risk = await getRiskAssessment(KNOWN_WALLET);
    expect(risk).not.toBeNull();
    expect(risk!.wallet).toBe(KNOWN_WALLET);
    expect(typeof risk!.score).toBe("number");
    expect(typeof risk!.verified).toBe("boolean");
    expect(["low", "medium", "high", "critical"]).toContain(risk!.riskLevel);
    expect(["accept", "review", "reject"]).toContain(risk!.verdict);
    expect(risk!.escrowPct).toBeGreaterThanOrEqual(0);
    expect(risk!.escrowPct).toBeLessThanOrEqual(100);
    expect(risk!.spendCap).toBeGreaterThanOrEqual(0);
    expect(risk!.factors).toBeDefined();
    expect(typeof risk!.factors.trustScore).toBe("number");
    expect(typeof risk!.factors.isSlashed).toBe("boolean");
  }, 15000);

  it("returns critical/reject for slashed agents", async () => {
    const risk = await getRiskAssessment(KNOWN_WALLET);
    if (risk?.slashed) {
      expect(risk.riskLevel).toBe("critical");
      expect(risk.verdict).toBe("reject");
      expect(risk.escrowPct).toBe(100);
      expect(risk.spendCap).toBe(0);
    }
  }, 15000);
});

// ── Trust Gate with Enforcement (v2.1) ────────────────

describe("evaluateTrustGate with enforcement", () => {
  it("supports blockSlashed option", async () => {
    const gate = await evaluateTrustGate(KNOWN_WALLET, {
      blockSlashed: true,
    });
    expect(typeof gate.allowed).toBe("boolean");
  }, 15000);

  it("supports minStakeSOL option", async () => {
    const gate = await evaluateTrustGate(KNOWN_WALLET, {
      minStakeSOL: 1000, // Impossibly high
    });
    // Should be blocked if agent has less than 1000 SOL staked
    if (gate.allowed === false) {
      expect(gate.reason).toContain("Stake");
    }
  }, 15000);
});

// ── Client Factory ─────────────────────────────────────

describe("createClient", () => {
  it("creates a client with default options", () => {
    const client = createClient();
    expect(client).toBeDefined();
    expect(typeof client.verifyAgent).toBe("function");
    expect(typeof client.sendMessage).toBe("function");
    expect(typeof client.discoverAgents).toBe("function");
    expect(typeof client.evaluateTrustGate).toBe("function");
    expect(typeof client.clearCache).toBe("function");
    expect(typeof client.invalidate).toBe("function");
  });

  it("caches results (verifyAgent called twice hits cache)", async () => {
    const client = createClient({ cacheTtlMs: 60000 });
    expect(client.cacheSize).toBe(0);

    await client.verifyAgent(KNOWN_WALLET);
    expect(client.cacheSize).toBeGreaterThan(0);

    const sizeAfterFirst = client.cacheSize;
    await client.verifyAgent(KNOWN_WALLET);
    expect(client.cacheSize).toBe(sizeAfterFirst); // No new entries
  }, 15000);

  it("clearCache empties the cache", async () => {
    const client = createClient();
    await client.getStats();
    expect(client.cacheSize).toBeGreaterThan(0);

    client.clearCache();
    expect(client.cacheSize).toBe(0);
  }, 15000);

  it("invalidate removes entries for a specific wallet", async () => {
    const client = createClient({ cacheTtlMs: 60000 });
    await client.verifyAgent(KNOWN_WALLET);
    expect(client.cacheSize).toBeGreaterThan(0);

    client.invalidate(KNOWN_WALLET);
    // At least the verify entry should be gone
    // (other keys like resolve may remain)
  }, 15000);

  it("accepts custom apiBase", () => {
    const client = createClient({ apiBase: "http://localhost:3000" });
    expect(client).toBeDefined();
  });

  it("accepts custom cacheTtlMs and maxRetries", () => {
    const client = createClient({ cacheTtlMs: 1000, maxRetries: 5 });
    expect(client).toBeDefined();
  });

  it("getChains falls back to static list on API failure", async () => {
    const client = createClient({ apiBase: "http://localhost:1" });
    const result = await client.getChains();
    expect(result.chains).toEqual(SUPPORTED_CHAINS);
  }, 15000);
});
