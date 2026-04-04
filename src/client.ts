/**
 * SAID A2A Client
 *
 * Wraps the live SAID Protocol API for:
 * - Cross-chain agent resolution (Solana + 9 EVM chains)
 * - Identity-gated A2A messaging with x402 micropayments
 * - Agent discovery across chains
 * - Trust-gated communication policies
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
} from "./types";

const API_BASE = "https://api.saidprotocol.com";

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

// ── Agent Resolution ───────────────────────────────────

/**
 * Resolve any wallet address to agent identities across all chains
 * Auto-detects chain from address format if not specified
 */
export async function resolveAgent(
  address: string,
  chain?: Chain
): Promise<AgentIdentity[]> {
  const url = chain
    ? `${API_BASE}/xchain/resolve/${address}?chain=${chain}`
    : `${API_BASE}/xchain/resolve/${address}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Resolution failed: ${res.status}`);

  const data = await res.json();
  return data.agents || [];
}

/**
 * Get full agent verification + trust score from SAID
 */
export async function verifyAgent(wallet: string): Promise<AgentIdentity | null> {
  const res = await fetch(`${API_BASE}/api/verify/${wallet}`);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Verification failed: ${res.status}`);
  }

  const data = await res.json();
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
export async function getAgentCard(wallet: string): Promise<AgentCard | null> {
  const res = await fetch(`${API_BASE}/a2a/${wallet}/agent-card.json`);
  if (!res.ok) return null;
  return res.json();
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
  msg: CrossChainMessage
): Promise<MessageResult> {
  const res = await fetch(`${API_BASE}/xchain/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(msg),
  });

  // x402 Payment Required
  if (res.status === 402) {
    const paymentInfo = await res.json().catch(() => null);
    return {
      success: false,
      status: "payment_required",
      paid: false,
      error: `Free tier exhausted. Payment required: $0.01 USDC via x402.`,
      trustGate: paymentInfo?.trustGate,
    };
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    return {
      success: false,
      status: "denied",
      paid: false,
      error: err.error || `Message failed: ${res.status}`,
    };
  }

  return res.json();
}

/**
 * Get inbox messages for an agent (cross-chain)
 */
export async function getInbox(
  chain: Chain,
  address: string,
  limit = 20
): Promise<any> {
  const res = await fetch(
    `${API_BASE}/xchain/inbox/${chain}/${address}?limit=${limit}`
  );
  if (!res.ok) throw new Error(`Inbox fetch failed: ${res.status}`);
  return res.json();
}

// ── Free Tier Status ───────────────────────────────────

/**
 * Check free tier usage for an address
 */
export async function getFreeTierStatus(
  address: string
): Promise<PaymentConfig> {
  const res = await fetch(`${API_BASE}/xchain/free-tier/${address}`);
  if (!res.ok) throw new Error(`Free tier check failed: ${res.status}`);
  const data = await res.json();

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
  query: DiscoveryQuery = {}
): Promise<DiscoveryResult> {
  const params = new URLSearchParams();
  if (query.chains) params.set("chains", query.chains.join(","));
  if (query.capability) params.set("capability", query.capability);
  if (query.verified) params.set("verified", "true");
  if (query.limit) params.set("limit", String(query.limit));

  const res = await fetch(`${API_BASE}/xchain/discover?${params}`);
  if (!res.ok) throw new Error(`Discovery failed: ${res.status}`);

  const data = await res.json();
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
  const res = await fetch(`${API_BASE}/xchain/stats`);
  if (!res.ok) throw new Error(`Stats failed: ${res.status}`);
  return res.json();
}

// ── Trust-Gated Communication ──────────────────────────

export interface TrustGateConfig {
  /** Minimum trust score to send messages (0-100) */
  minSenderScore?: number;
  /** Require sender to be SAID-verified */
  requireVerified?: boolean;
  /** Block anonymous (unregistered) senders */
  blockAnonymous?: boolean;
}

/**
 * Evaluate whether an agent should be allowed to send a message
 * based on their SAID trust score
 *
 * This is the communication equivalent of ows-policy's spending limits:
 * - ows-policy gates transactions based on trust
 * - ows-a2a gates messages based on trust
 */
export async function evaluateTrustGate(
  senderAddress: string,
  config: TrustGateConfig = {}
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

  return { allowed: true, agent };
}
