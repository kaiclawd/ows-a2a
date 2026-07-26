/**
 * SAID A2A Client v2.0.0
 *
 * Enforcement-native cross-chain agent communication.
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
  EnforcementData,
  UnifiedTrustResult,
} from "./types";

const API_BASE = "https://api.saidprotocol.com";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ── Supported Chains ───────────────────────────────────

export const SUPPORTED_CHAINS: Chain[] = [
  "solana", "ethereum", "base", "arbitrum", "avalanche",
  "optimism", "polygon", "celo", "gnosis", "bnb",
];

export const PAYMENT_NETWORKS: Record<string, string> = {
  solana: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
  base: "eip155:8453",
  polygon: "eip155:137",
  avalanche: "eip155:43114",
};

// ── Cache ──────────────────────────────────────────────

interface CacheEntry<T> { value: T; expires: number; }
const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && entry.expires > Date.now()) return entry.value as T;
  cache.delete(key);
  return null;
}

function setCached<T>(key: string, value: T, ttl = CACHE_TTL_MS): void {
  cache.set(key, { value, expires: Date.now() + ttl });
}

// ── Typed fetch helper ─────────────────────────────────

async function fetchJSON(url: string, init?: RequestInit): Promise<any> {
  const res = await fetch(url, init);
  return { res, data: res.ok ? await res.json() : null };
}

// ── Agent Resolution ───────────────────────────────────

export async function resolveAgent(
  address: string, chain?: Chain
): Promise<AgentIdentity[]> {
  const url = chain
    ? `${API_BASE}/xchain/resolve/${address}?chain=${chain}`
    : `${API_BASE}/xchain/resolve/${address}`;
  const { res, data } = await fetchJSON(url);
  if (!res.ok) throw new Error(`Resolution failed: ${res.status}`);
  return data?.agents || [];
}

export async function verifyAgent(wallet: string): Promise<AgentIdentity | null> {
  const cacheKey = `verify:${wallet}`;
  const cached = getCached<AgentIdentity | null>(cacheKey);
  if (cached !== null) return cached;

  const { res, data } = await fetchJSON(`${API_BASE}/api/verify/${wallet}`);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Verification failed: ${res.status}`);
  }

  if (!data?.registered) return null;

  const agent: AgentIdentity = {
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

  setCached(cacheKey, agent);
  return agent;
}

// ── Enforcement Data (v2.0) ────────────────────────────

export async function getEnforcement(
  wallet: string
): Promise<EnforcementData | null> {
  const cacheKey = `enforcement:${wallet}`;
  const cached = getCached<EnforcementData | null>(cacheKey);
  if (cached !== null) return cached;

  try {
    const { res, data } = await fetchJSON(`${API_BASE}/api/enforcement/${wallet}`);
    if (!res.ok || !data) {
      setCached(cacheKey, null);
      return null;
    }

    const enforcement: EnforcementData = {
      staked: data.staked ?? false,
      slashed: data.slashed ?? (data.slashCount ?? 0) > 0,
      slashCount: data.slashCount ?? 0,
      enforcementTier: data.enforcementTier ?? (data.staked ? "bronze" : "none"),
      stakePda: data.stakePda,
      stakeAmountSOL: data.stakeAmountSOL,
      lastSlashSlot: data.lastSlashSlot,
    };

    setCached(cacheKey, enforcement);
    return enforcement;
  } catch {
    setCached(cacheKey, null);
    return null;
  }
}

// ── Unified Trust (Identity + Enforcement) ─────────────

export async function getUnifiedTrust(
  wallet: string
): Promise<UnifiedTrustResult> {
  const cacheKey = `unified:${wallet}`;
  const cached = getCached<UnifiedTrustResult>(cacheKey);
  if (cached) return cached;

  const [identity, enforcement] = await Promise.all([
    verifyAgent(wallet),
    getEnforcement(wallet),
  ]);

  const hasSkinInGame = enforcement?.staked === true && enforcement?.slashed !== true;
  const score = identity?.trustScore?.score ?? 0;
  const staked = enforcement?.staked ?? false;
  const slashCount = enforcement?.slashCount ?? 0;

  let verdict: UnifiedTrustResult["verdict"];
  let maxTxValueUSDC: number;
  let recommendedEscrowPct: number;
  let insight: string;

  if (!identity && !enforcement) {
    verdict = "insufficient_evidence";
    maxTxValueUSDC = 0;
    recommendedEscrowPct = 50;
    insight = "No SAID identity or enforcement data. Unknown agent — require full escrow.";
  } else if (slashCount > 2 || (identity?.trustScore && score < 20)) {
    verdict = "untrusted";
    maxTxValueUSDC = 0;
    recommendedEscrowPct = 100;
    insight = `Agent has ${slashCount} slashing events${score ? ` and low trust score (${score})` : ""}. Deny communication.`;
  } else if (staked && identity?.verified && score >= 40) {
    verdict = "trusted";
    maxTxValueUSDC = enforcement?.stakeAmountSOL
      ? Math.min(enforcement.stakeAmountSOL * 100, 10000)
      : 1000;
    recommendedEscrowPct = 5;
    insight = `Verified agent with ${enforcement?.stakeAmountSOL ?? "unknown"} SOL staked. Trusted for A2A communication.`;
  } else if (identity?.verified || staked) {
    verdict = "provisional";
    maxTxValueUSDC = staked ? 500 : 100;
    recommendedEscrowPct = staked ? 10 : 20;
    insight = `Agent has ${identity?.verified ? "verification" : ""}${identity?.verified && staked ? " + " : ""}${staked ? "staking" : ""}. Provisional trust.`;
  } else {
    verdict = "insufficient_evidence";
    maxTxValueUSDC = 50;
    recommendedEscrowPct = 30;
    insight = "Agent registered but unverified and unstaked. Limited trust.";
  }

  const result: UnifiedTrustResult = {
    wallet, identity, enforcement, verdict,
    hasSkinInGame, maxTxValueUSDC, recommendedEscrowPct, insight,
  };

  setCached(cacheKey, result);
  return result;
}

// ── A2A Agent Card ─────────────────────────────────────

export async function getAgentCard(wallet: string): Promise<AgentCard | null> {
  const { res, data } = await fetchJSON(`${API_BASE}/a2a/${wallet}/agent-card.json`);
  if (!res.ok || !data) return null;
  return data as AgentCard;
}

// ── Cross-Chain Messaging ──────────────────────────────

export async function sendMessage(
  msg: CrossChainMessage
): Promise<MessageResult> {
  const res = await fetch(`${API_BASE}/xchain/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(msg),
  });

  if (res.status === 402) {
    const paymentInfo: any = await res.json().catch(() => null);
    return {
      success: false,
      status: "payment_required",
      paid: false,
      error: "Free tier exhausted. Payment required: $0.01 USDC via x402.",
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

  return (await res.json()) as MessageResult;
}

export async function getInbox(
  chain: Chain, address: string, limit = 20
): Promise<any> {
  const res = await fetch(
    `${API_BASE}/xchain/inbox/${chain}/${address}?limit=${limit}`
  );
  if (!res.ok) throw new Error(`Inbox fetch failed: ${res.status}`);
  return res.json();
}

// ── Free Tier Status ───────────────────────────────────

export async function getFreeTierStatus(
  address: string
): Promise<PaymentConfig> {
  const { res, data } = await fetchJSON(`${API_BASE}/xchain/free-tier/${address}`);
  if (!res.ok) throw new Error(`Free tier check failed: ${res.status}`);

  return {
    price: "$0.01",
    currency: "USDC",
    treasury: "EK3mP45iwgDEEts2cEDfhAs2i4PrH63NMG7vHg2d6fas",
    network: "solana",
    protocol: "x402",
    freeTier: {
      messagesPerDay: data?.limit || 10,
      used: data?.used || 0,
      remaining: data?.remaining || 10,
    },
  };
}

// ── Discovery ──────────────────────────────────────────

export async function discoverAgents(
  query: DiscoveryQuery = {}
): Promise<DiscoveryResult> {
  const params = new URLSearchParams();
  if (query.chains) params.set("chains", query.chains.join(","));
  if (query.capability) params.set("capability", query.capability);
  if (query.verified) params.set("verified", "true");
  if (query.minTrustScore) params.set("minTrustScore", String(query.minTrustScore));
  if (query.limit) params.set("limit", String(query.limit));

  const { res, data } = await fetchJSON(`${API_BASE}/xchain/discover?${params}`);
  if (!res.ok) throw new Error(`Discovery failed: ${res.status}`);

  return {
    agents: data?.agents || [],
    count: data?.count || 0,
    chains: query.chains || SUPPORTED_CHAINS,
  };
}

export async function getStats(): Promise<{
  totalAgents: number;
  totalChains: number;
  chains: Record<string, { source: string; agents: number }>;
}> {
  const { res, data } = await fetchJSON(`${API_BASE}/xchain/stats`);
  if (!res.ok) throw new Error(`Stats failed: ${res.status}`);
  return data;
}

// ── Trust-Gated Communication ──────────────────────────

export interface TrustGateConfig {
  minSenderScore?: number;
  requireVerified?: boolean;
  blockAnonymous?: boolean;
  requireStaked?: boolean;
  maxSlashes?: number;
}

export interface TrustGateResult {
  allowed: boolean;
  reason?: string;
  agent?: AgentIdentity;
  enforcement?: EnforcementData | null;
  unifiedTrust?: UnifiedTrustResult;
}

export async function evaluateTrustGate(
  senderAddress: string,
  config: TrustGateConfig = {}
): Promise<TrustGateResult> {
  const [agent, enforcement] = await Promise.all([
    verifyAgent(senderAddress),
    getEnforcement(senderAddress),
  ]);

  if (!agent) {
    if (config.blockAnonymous) {
      return {
        allowed: false,
        reason: `No SAID identity for ${senderAddress}. Register at saidprotocol.com`,
        enforcement,
      };
    }
    return { allowed: true, enforcement };
  }

  if (config.requireVerified && !agent.verified) {
    return {
      allowed: false,
      reason: "Agent is not SAID-verified. Verification costs 0.01 SOL.",
      agent,
      enforcement,
    };
  }

  if (config.minSenderScore && agent.trustScore) {
    if (agent.trustScore.score < config.minSenderScore) {
      return {
        allowed: false,
        reason: `Trust score ${agent.trustScore.score} below minimum ${config.minSenderScore}`,
        agent,
        enforcement,
      };
    }
  }

  if (config.requireStaked && !enforcement?.staked) {
    return {
      allowed: false,
      reason: "Agent has no staked collateral. Stake SOL at saidprotocol.com to enable A2A messaging.",
      agent,
      enforcement,
    };
  }

  const maxSlashes = config.maxSlashes ?? 0;
  if (enforcement && enforcement.slashCount > maxSlashes) {
    return {
      allowed: false,
      reason: `Agent has ${enforcement.slashCount} slashing events (max ${maxSlashes} allowed). Economic trust violated.`,
      agent,
      enforcement,
    };
  }

  return { allowed: true, agent, enforcement };
}

// ── Preset Policies ────────────────────────────────────

export const STRICT_POLICY: TrustGateConfig = {
  requireVerified: true, requireStaked: true,
  minSenderScore: 40, maxSlashes: 0, blockAnonymous: true,
};

export const BALANCED_POLICY: TrustGateConfig = {
  requireVerified: true, minSenderScore: 20,
  maxSlashes: 1, blockAnonymous: true,
};

export const PERMISSIVE_POLICY: TrustGateConfig = {
  maxSlashes: 2,
};

export const MARKETPLACE_POLICY: TrustGateConfig = {
  requireVerified: true, requireStaked: true,
  minSenderScore: 30, maxSlashes: 1, blockAnonymous: true,
};

export const MAXIMUM_SECURITY_POLICY: TrustGateConfig = {
  requireVerified: true, requireStaked: true,
  minSenderScore: 60, maxSlashes: 0, blockAnonymous: true,
};
