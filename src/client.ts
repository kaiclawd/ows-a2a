/**
 * SAID A2A Client v2.0.0
 *
 * Wraps the live SAID Protocol API for:
 * - Cross-chain agent resolution (Solana + 9 EVM chains)
 * - Identity-gated A2A messaging with x402 micropayments
 * - Agent discovery across chains
 * - Trust-gated communication policies
 * - On-chain enforcement data (staking/slashing/risk)
 */

import type {
  Chain,
  AgentIdentity,
  AgentCard,
  CrossChainMessage,
  MessageResult,
  PaymentConfig,
  DiscoveryQuery,
  DiscoveryResult,
  EnforcementStatus,
  RiskAssessment,
} from "./types";

const API_BASE = process.env.SAID_API_URL || "https://api.saidprotocol.com";

// ── Supported Chains ───────────────────────────────────

export const SUPPORTED_CHAINS: Chain[] = [
  "solana",
  "ethereum",
  "base",
  "arbitrum",
  "avalanche",
  "optimism",
  "polygon",
  "celo",
  "gnosis",
  "bnb",
];

// CAIP-2 identifiers for x402 payment
export const PAYMENT_NETWORKS: Record<string, string> = {
  solana: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
  base: "eip155:8453",
  polygon: "eip155:137",
  avalanche: "eip155:43114",
};

// ── Retry Helper ───────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 10_000;

async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  retries = 2,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    // Retry on 5xx
    if (res.status >= 500 && retries > 0) {
      await new Promise((r) => setTimeout(r, 500 * (3 - retries)));
      return fetchWithRetry(url, options, retries - 1);
    }

    return res;
  } catch (err) {
    if (retries > 0 && err instanceof Error && err.name !== "AbortError") {
      await new Promise((r) => setTimeout(r, 500 * (3 - retries)));
      return fetchWithRetry(url, options, retries - 1);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

// ── Agent Resolution ───────────────────────────────────

/**
 * Resolve any wallet address to agent identities across all chains
 * Auto-detects chain from address format if not specified
 */
export async function resolveAgent(
  address: string,
  chain?: Chain,
): Promise<AgentIdentity[]> {
  const url = chain
    ? `${API_BASE}/xchain/resolve/${address}?chain=${chain}`
    : `${API_BASE}/xchain/resolve/${address}`;

  const res = await fetchWithRetry(url);
  if (!res.ok) throw new Error(`Resolution failed: ${res.status}`);

  const data: any = await res.json();
  return data.agents || [];
}

/**
 * Get full agent verification + trust score from SAID
 */
export async function verifyAgent(
  wallet: string,
): Promise<AgentIdentity | null> {
  const res = await fetchWithRetry(`${API_BASE}/api/verify/${wallet}`);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Verification failed: ${res.status}`);
  }

  const data: any = await res.json();
  if (!data.registered) return null;

  return {
    address: data.wallet,
    chain: "solana",
    source: "said",
    name: data.identity?.name || "Unnamed Agent",
    description: data.identity?.description || "",
    capabilities: data.skills || [],
    endpoint: data.endpoints?.a2a || undefined,
    verified: data.verified,
    reputationScore: data.reputation?.score || 0,
    trustScore: data.trustScore || undefined,
    registeredAt: data.registeredAt,
  };
}

// ── A2A Agent Card ─────────────────────────────────────

/**
 * Fetch A2A-compliant agent card for a SAID-registered agent
 */
export async function getAgentCard(
  wallet: string,
): Promise<AgentCard | null> {
  const res = await fetchWithRetry(
    `${API_BASE}/a2a/${wallet}/agent-card.json`,
  );
  if (!res.ok) return null;
  return res.json() as Promise<AgentCard>;
}

// ── Enforcement Data ───────────────────────────────────

/**
 * Get on-chain enforcement status (staking/slashing) for an agent
 *
 * This is SAID's unique differentiator — no other identity registry
 * has economic enforcement. Returns staked SOL, slashing history,
 * and enforcement tier.
 */
export async function getEnforcement(
  wallet: string,
): Promise<EnforcementStatus | null> {
  const res = await fetchWithRetry(
    `${API_BASE}/api/enforcement/${wallet}`,
  );
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Enforcement query failed: ${res.status}`);
  }

  const data: any = await res.json();
  return {
    wallet: data.wallet || wallet,
    staked: data.staked || false,
    stakeAmount: data.stakeAmount || 0,
    stakeAmountSOL: data.stakeAmountSOL || 0,
    slashed: data.slashed || false,
    slashCount: data.slashCount || 0,
    slashHistory: data.slashHistory || [],
    enforcementTier: data.enforcementTier || "none",
    lastUpdated: data.lastUpdated || new Date().toISOString(),
  };
}

/**
 * Get risk assessment for an agent — combines trust score + enforcement
 *
 * Returns a marketplace-ready verdict (accept/review/reject),
 * recommended escrow percentage, and spend caps.
 */
export async function getRiskAssessment(
  wallet: string,
): Promise<RiskAssessment | null> {
  // Fetch verification + enforcement in parallel
  const [agent, enforcement] = await Promise.all([
    verifyAgent(wallet),
    getEnforcement(wallet),
  ]);

  if (!agent) return null;

  const score = agent.trustScore?.score ?? 0;
  const slashed = enforcement?.slashed ?? false;
  const stakeAmount = enforcement?.stakeAmountSOL ?? 0;

  // Risk calculation
  let riskLevel: RiskAssessment["riskLevel"];
  let verdict: RiskAssessment["verdict"];
  let escrowPct: number;
  let spendCap: number;

  if (slashed) {
    riskLevel = "critical";
    verdict = "reject";
    escrowPct = 100;
    spendCap = 0;
  } else if (score >= 70 && agent.verified) {
    riskLevel = "low";
    verdict = "accept";
    escrowPct = 0;
    spendCap = 10_000;
  } else if (score >= 50 && agent.verified) {
    riskLevel = "medium";
    verdict = "review";
    escrowPct = 25;
    spendCap = 1_000;
  } else if (score >= 25) {
    riskLevel = "high";
    verdict = "review";
    escrowPct = 50;
    spendCap = 250;
  } else {
    riskLevel = "critical";
    verdict = "reject";
    escrowPct = 100;
    spendCap = 0;
  }

  // Stake bonus: staked agents get lower escrow
  if (stakeAmount >= 1 && !slashed) {
    escrowPct = Math.max(0, escrowPct - 10);
  }

  return {
    wallet,
    score,
    tier: agent.trustScore?.tier || "unknown",
    verified: agent.verified,
    riskLevel,
    verdict,
    escrowPct,
    spendCap,
    staked: enforcement?.staked ?? false,
    stakeAmountSOL: stakeAmount,
    slashed,
    slashCount: enforcement?.slashCount ?? 0,
    factors: {
      trustScore: score,
      verified: agent.verified,
      hasStake: enforcement?.staked ?? false,
      stakeAmountSOL: stakeAmount,
      isSlashed: slashed,
      slashCount: enforcement?.slashCount ?? 0,
    },
  };
}

// ── Cross-Chain Messaging ──────────────────────────────

/**
 * Send a cross-chain message between agents
 *
 * Flow:
 * 1. Resolve sender + recipient across chains
 * 2. Check SAID trust scores for both parties
 * 3. Free tier: 10 messages/day per agent
 * 4. After free tier: x402 USDC micropayment ($0.01)
 * 5. Deliver via WebSocket > A2A endpoint > webhook
 */
export async function sendMessage(
  msg: CrossChainMessage,
): Promise<MessageResult> {
  const res = await fetchWithRetry(`${API_BASE}/xchain/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(msg),
  });

  // x402 Payment Required
  if (res.status === 402) {
    const paymentInfo: any = await res.json().catch(() => null);
    return {
      success: false,
      status: "payment_required",
      paid: false,
      error: `Free tier exhausted. Payment required: $0.01 USDC via x402.`,
      trustGate: paymentInfo?.trustGate,
    };
  }

  if (!res.ok) {
    const err: any = await res.json().catch(() => ({ error: "Unknown error" }));
    return {
      success: false,
      status: "denied",
      paid: false,
      error: err.error || `Message failed: ${res.status}`,
    };
  }

  return res.json() as Promise<MessageResult>;
}

/**
 * Get inbox messages for an agent (cross-chain)
 */
export async function getInbox(
  chain: Chain,
  address: string,
  limit = 20,
): Promise<any> {
  const res = await fetchWithRetry(
    `${API_BASE}/xchain/inbox/${chain}/${address}?limit=${limit}`,
  );
  if (!res.ok) throw new Error(`Inbox fetch failed: ${res.status}`);
  return (await res.json()) as MessageResult;
}

// ── Free Tier Status ───────────────────────────────────

/**
 * Check free tier usage for an address
 */
export async function getFreeTierStatus(
  address: string,
): Promise<PaymentConfig> {
  const res = await fetchWithRetry(
    `${API_BASE}/xchain/free-tier/${address}`,
  );
  if (!res.ok) throw new Error(`Free tier check failed: ${res.status}`);
  const data: any = await res.json();

  return {
    price: "$0.01",
    currency: "USDC",
    treasury: "EK3mP45iwgDEEts2cEDfhAs2i4PrH63NMG7vHg2d6fas",
    network: "solana",
    protocol: "x402",
    freeTier: {
      messagesPerDay: data.limit || 10,
      used: data.used || 0,
      remaining: data.remaining || 10,
    },
  };
}

// ── Discovery ──────────────────────────────────────────

/**
 * Discover agents across chains
 */
export async function discoverAgents(
  query: DiscoveryQuery = {},
): Promise<DiscoveryResult> {
  const params = new URLSearchParams();
  if (query.chains) params.set("chains", query.chains.join(","));
  if (query.capability) params.set("capability", query.capability);
  if (query.verified) params.set("verified", "true");
  if (query.limit) params.set("limit", String(query.limit));

  const res = await fetchWithRetry(
    `${API_BASE}/xchain/discover?${params}`,
  );
  if (!res.ok) throw new Error(`Discovery failed: ${res.status}`);

  const data: any = await res.json();
  return {
    agents: data.agents || [],
    count: data.count || 0,
    chains: query.chains || SUPPORTED_CHAINS,
  };
}

/**
 * Get cross-chain registry stats
 */
export async function getStats(): Promise<{
  totalAgents: number;
  totalChains: number;
  chains: Record<string, { source: string; agents: number }>;
}> {
  const res = await fetchWithRetry(`${API_BASE}/xchain/stats`);
  if (!res.ok) throw new Error(`Stats failed: ${res.status}`);
  return res.json() as Promise<{
    totalAgents: number;
    totalChains: number;
    chains: Record<string, { source: string; agents: number }>;
  }>;
}

// ── Trust-Gated Communication ──────────────────────────

export interface TrustGateConfig {
  /** Minimum trust score to send messages (0-100) */
  minSenderScore?: number;
  /** Require sender to be SAID-verified */
  requireVerified?: boolean;
  /** Block anonymous (unregistered) senders */
  blockAnonymous?: boolean;
  /** Reject agents that have been slashed on-chain */
  blockSlashed?: boolean;
  /** Require minimum stake in SOL */
  minStakeSOL?: number;
}

/**
 * Evaluate whether an agent should be allowed to send a message
 * based on their SAID trust score AND enforcement status
 *
 * This is the communication equivalent of ows-policy's spending limits:
 * - ows-policy gates transactions based on trust
 * - ows-a2a gates messages based on trust + enforcement
 */
export async function evaluateTrustGate(
  senderAddress: string,
  config: TrustGateConfig = {},
): Promise<{ allowed: boolean; reason?: string; agent?: AgentIdentity }> {
  const agent = await verifyAgent(senderAddress);

  if (!agent) {
    if (config.blockAnonymous) {
      return {
        allowed: false,
        reason: `No SAID identity for ${senderAddress}. Register at saidprotocol.com`,
      };
    }
    return { allowed: true };
  }

  if (config.requireVerified && !agent.verified) {
    return {
      allowed: false,
      reason: `Agent is not SAID-verified. Verification costs 0.01 SOL.`,
      agent,
    };
  }

  if (config.minSenderScore && agent.trustScore) {
    if (agent.trustScore.score < config.minSenderScore) {
      return {
        allowed: false,
        reason: `Trust score ${agent.trustScore.score} below minimum ${config.minSenderScore}`,
        agent,
      };
    }
  }

  // Enforcement checks (v2.0 — economic security)
  if (config.blockSlashed || config.minStakeSOL) {
    const enforcement = await getEnforcement(senderAddress);

    if (config.blockSlashed && enforcement?.slashed) {
      return {
        allowed: false,
        reason: `Agent has been slashed ${enforcement.slashCount}x on-chain. Economic enforcement active.`,
        agent,
      };
    }

    if (
      config.minStakeSOL &&
      enforcement &&
      enforcement.stakeAmountSOL < config.minStakeSOL
    ) {
      return {
        allowed: false,
        reason: `Stake ${enforcement.stakeAmountSOL.toFixed(2)} SOL below minimum ${config.minStakeSOL} SOL`,
        agent,
      };
    }
  }

  return { allowed: true, agent };
}
