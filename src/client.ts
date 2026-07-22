/**
 * SAID A2A Client
 *
 * Wraps the live SAID Protocol API for:
 * - Cross-chain agent resolution (Solana + 9 EVM chains)
 * - Identity-gated A2A messaging with x402 micropayments
 * - Agent discovery across chains
 * - Trust-gated communication policies
 *
 * v2.0.0: Added caching, retry, proper typing, getChains()
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
  TrustGateConfig,
  TrustGateResult,
  SAIDStats,
} from "./types";

// ── Configuration ──────────────────────────────────────

const DEFAULT_API_BASE = "https://api.saidprotocol.com";
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 500;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

export interface SAIDClientOptions {
  /** Override the API base URL (defaults to production) */
  apiBase?: string;
  /** Cache TTL in milliseconds (default: 300000 = 5 min) */
  cacheTtlMs?: number;
  /** Max retry attempts on 5xx/429 (default: 3) */
  maxRetries?: number;
}

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

// ── Internal Cache ─────────────────────────────────────

interface CacheEntry<T> {
  value: T;
  expires: number;
}

class TTLCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private ttlMs: number;

  constructor(ttlMs: number) {
    this.ttlMs = ttlMs;
  }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expires) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T): void {
    this.store.set(key, { value, expires: Date.now() + this.ttlMs });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}

// ── Fetch with Retry ───────────────────────────────────

async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  maxRetries: number = DEFAULT_MAX_RETRIES
): Promise<Response> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, options);

      // Retry on 429/5xx
      if (RETRYABLE_STATUS.has(res.status) && attempt < maxRetries) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        await sleep(delay);
        continue;
      }

      return res;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        await sleep(delay);
        continue;
      }
    }
  }

  throw lastError ?? new Error("Request failed after retries");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── SAID A2A Client ────────────────────────────────────

/**
 * Create a configured SAID A2A client with caching and retry.
 *
 * ```typescript
 * const client = createClient({ cacheTtlMs: 60000 });
 * const agent = await client.verifyAgent("wallet...");
 * ```
 */
export function createClient(opts: SAIDClientOptions = {}) {
  const apiBase = opts.apiBase ?? DEFAULT_API_BASE;
  const cache = new TTLCache(opts.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS);
  const maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;

  return {
    /** Clear the in-memory cache */
    clearCache(): void {
      cache.clear();
    },

    /** Get current cache size */
    get cacheSize(): number {
      return cache.size;
    },

    // ── Agent Resolution ───────────────────────────────

    /**
     * Resolve any wallet address to agent identities across all chains.
     * Auto-detects chain from address format if not specified.
     */
    async resolveAgent(address: string, chain?: Chain): Promise<AgentIdentity[]> {
      const cacheKey = `resolve:${address}:${chain ?? "auto"}`;
      const cached = cache.get<AgentIdentity[]>(cacheKey);
      if (cached) return cached;

      const url = chain
        ? `${apiBase}/xchain/resolve/${address}?chain=${chain}`
        : `${apiBase}/xchain/resolve/${address}`;

      const res = await fetchWithRetry(url, undefined, maxRetries);
      if (!res.ok) throw new Error(`Resolution failed: ${res.status}`);

      const data = (await res.json()) as { agents?: AgentIdentity[] };
      const agents = data.agents ?? [];
      cache.set(cacheKey, agents);
      return agents;
    },

    /**
     * Get full agent verification + trust score from SAID.
     * Returns null if the wallet is not registered.
     */
    async verifyAgent(wallet: string): Promise<AgentIdentity | null> {
      const cacheKey = `verify:${wallet}`;
      const cached = cache.get<AgentIdentity | null>(cacheKey);
      if (cached !== undefined) return cached;

      const res = await fetchWithRetry(
        `${apiBase}/api/verify/${wallet}`,
        undefined,
        maxRetries
      );

      if (res.status === 404) {
        cache.set(cacheKey, null);
        return null;
      }

      if (!res.ok) throw new Error(`Verification failed: ${res.status}`);

      const data = (await res.json()) as Record<string, unknown>;
      if (!data["registered"]) {
        cache.set(cacheKey, null);
        return null;
      }

      const identity = data["identity"] as Record<string, unknown> | undefined;
      const trustScore = data["trustScore"] as AgentIdentity["trustScore"] | undefined;
      const endpoints = data["endpoints"] as Record<string, string> | undefined;

      const agent: AgentIdentity = {
        address: (data["wallet"] as string) ?? wallet,
        chain: "solana",
        source: "said",
        name: (identity?.["name"] as string) ?? "Unnamed Agent",
        description: (identity?.["description"] as string) ?? "",
        capabilities: (data["skills"] as string[]) ?? [],
        endpoint: endpoints?.["a2a"],
        verified: (data["verified"] as boolean) ?? false,
        reputationScore: (data["reputation"] as { score?: number })?.score ?? 0,
        trustScore,
        registeredAt: data["registeredAt"] as string | undefined,
      };

      cache.set(cacheKey, agent);
      return agent;
    },

    // ── A2A Agent Card ─────────────────────────────────

    /**
     * Fetch A2A-compliant agent card for a SAID-registered agent.
     */
    async getAgentCard(wallet: string): Promise<AgentCard | null> {
      const cacheKey = `card:${wallet}`;
      const cached = cache.get<AgentCard | null>(cacheKey);
      if (cached !== undefined) return cached;

      const res = await fetchWithRetry(
        `${apiBase}/a2a/${wallet}/agent-card.json`,
        undefined,
        maxRetries
      );

      if (!res.ok) {
        cache.set(cacheKey, null);
        return null;
      }

      const card = (await res.json()) as AgentCard;
      cache.set(cacheKey, card);
      return card;
    },

    // ── Cross-Chain Messaging ──────────────────────────

    /**
     * Send a cross-chain message between agents.
     *
     * Flow:
     * 1. Resolve sender + recipient across chains
     * 2. Check SAID trust scores for both parties
     * 3. Free tier: 10 messages/day per agent
     * 4. After free tier: x402 USDC micropayment ($0.01)
     * 5. Deliver via WebSocket > A2A endpoint > webhook
     */
    async sendMessage(msg: CrossChainMessage): Promise<MessageResult> {
      const res = await fetchWithRetry(
        `${apiBase}/xchain/message`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(msg),
        },
        maxRetries
      );

      // x402 Payment Required — don't retry, surface to caller
      if (res.status === 402) {
        const paymentInfo = (await res.json().catch(() => ({}))) as {
          trustGate?: MessageResult["trustGate"];
        };
        return {
          success: false,
          status: "payment_required",
          paid: false,
          error: "Free tier exhausted. Payment required: $0.01 USDC via x402.",
          trustGate: paymentInfo.trustGate,
        };
      }

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        return {
          success: false,
          status: "denied",
          paid: false,
          error: err.error ?? `Message failed: ${res.status}`,
        };
      }

      const result = (await res.json()) as MessageResult;
      return result;
    },

    /**
     * Get inbox messages for an agent (cross-chain).
     */
    async getInbox(chain: Chain, address: string, limit = 20): Promise<unknown> {
      const cacheKey = `inbox:${chain}:${address}:${limit}`;
      const cached = cache.get<unknown>(cacheKey);
      if (cached !== undefined) return cached;

      const res = await fetchWithRetry(
        `${apiBase}/xchain/inbox/${chain}/${address}?limit=${limit}`,
        undefined,
        maxRetries
      );

      if (!res.ok) throw new Error(`Inbox fetch failed: ${res.status}`);

      const data = await res.json();
      cache.set(cacheKey, data);
      return data;
    },

    // ── Free Tier Status ───────────────────────────────

    /**
     * Check free tier usage for an address.
     */
    async getFreeTierStatus(address: string): Promise<PaymentConfig> {
      const res = await fetchWithRetry(
        `${apiBase}/xchain/free-tier/${address}`,
        undefined,
        maxRetries
      );

      if (!res.ok) throw new Error(`Free tier check failed: ${res.status}`);

      const data = (await res.json()) as {
        limit?: number;
        used?: number;
        remaining?: number;
      };

      return {
        price: "$0.01",
        currency: "USDC",
        treasury: "EK3mP45iwgDEEts2cEDfhAs2i4PrH63NMG7vHg2d6fas",
        network: "solana",
        protocol: "x402",
        freeTier: {
          messagesPerDay: data.limit ?? 10,
          used: data.used ?? 0,
          remaining: data.remaining ?? 10,
        },
      };
    },

    // ── Discovery ──────────────────────────────────────

    /**
     * Discover agents across chains.
     */
    async discoverAgents(query: DiscoveryQuery = {}): Promise<DiscoveryResult> {
      const params = new URLSearchParams();
      if (query.chains) params.set("chains", query.chains.join(","));
      if (query.capability) params.set("capability", query.capability);
      if (query.verified) params.set("verified", "true");
      if (query.limit) params.set("limit", String(query.limit));

      const cacheKey = `discover:${params.toString()}`;
      const cached = cache.get<DiscoveryResult>(cacheKey);
      if (cached) return cached;

      const res = await fetchWithRetry(
        `${apiBase}/xchain/discover?${params}`,
        undefined,
        maxRetries
      );

      if (!res.ok) throw new Error(`Discovery failed: ${res.status}`);

      const data = (await res.json()) as { agents?: AgentIdentity[]; count?: number };
      const result: DiscoveryResult = {
        agents: data.agents ?? [],
        count: data.count ?? 0,
        chains: query.chains ?? SUPPORTED_CHAINS,
      };

      cache.set(cacheKey, result);
      return result;
    },

    /**
     * Get cross-chain registry stats.
     */
    async getStats(): Promise<SAIDStats> {
      const cacheKey = "stats";
      const cached = cache.get<SAIDStats>(cacheKey);
      if (cached) return cached;

      const res = await fetchWithRetry(
        `${apiBase}/xchain/stats`,
        undefined,
        maxRetries
      );

      if (!res.ok) throw new Error(`Stats failed: ${res.status}`);

      const data = (await res.json()) as SAIDStats;
      cache.set(cacheKey, data);
      return data;
    },

    /**
     * Get list of supported chains.
     */
    async getChains(): Promise<{ chains: Chain[]; count: number }> {
      const cacheKey = "chains";
      const cached = cache.get<{ chains: Chain[]; count: number }>(cacheKey);
      if (cached) return cached;

      try {
        const res = await fetchWithRetry(
          `${apiBase}/xchain/chains`,
          undefined,
          maxRetries
        );

        if (!res.ok) throw new Error(`Chains fetch failed: ${res.status}`);

        const data = (await res.json()) as { chains?: Chain[] };
        const chains = data.chains ?? SUPPORTED_CHAINS;
        const result = { chains, count: chains.length };
        cache.set(cacheKey, result);
        return result;
      } catch {
        // Fallback to static list on any error
        const fallback = { chains: SUPPORTED_CHAINS, count: SUPPORTED_CHAINS.length };
        cache.set(cacheKey, fallback);
        return fallback;
      }
    },

    // ── Trust-Gated Communication ──────────────────────

    /**
     * Evaluate whether an agent should be allowed to send a message
     * based on their SAID trust score.
     *
     * This is the communication equivalent of ows-policy's spending limits:
     * - ows-policy gates transactions based on trust
     * - ows-a2a gates messages based on trust
     */
    async evaluateTrustGate(
      senderAddress: string,
      config: TrustGateConfig = {}
    ): Promise<TrustGateResult> {
      const agent = await this.verifyAgent(senderAddress);

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
          reason: "Agent is not SAID-verified. Verification costs 0.01 SOL.",
          agent,
        };
      }

      if (config.minSenderScore !== undefined && agent.trustScore) {
        if (agent.trustScore.score < config.minSenderScore) {
          return {
            allowed: false,
            reason: `Trust score ${agent.trustScore.score} below minimum ${config.minSenderScore}`,
            agent,
          };
        }
      }

      // Check if agent has been slashed (if trust data available)
      if (config.blockSlashed && agent.trustScore) {
        const tier = agent.trustScore.tier.toLowerCase();
        if (tier === "slashed" || tier === "penalized") {
          return {
            allowed: false,
            reason: "Agent has been slashed on SAID Protocol.",
            agent,
          };
        }
      }

      return { allowed: true, agent };
    },

    /** Invalidate cache for a specific wallet */
    invalidate(wallet: string): void {
      cache.delete(`verify:${wallet}`);
      cache.delete(`resolve:${wallet}:auto`);
      cache.delete(`card:${wallet}`);
    },
  };
}

// ── Standalone Functions (backwards-compatible v1 API) ─

const defaultClient = createClient();

/**
 * Resolve any wallet address to agent identities across all chains.
 * Auto-detects chain from address format if not specified.
 * @deprecated Use createClient() for caching and retry. This works but is uncached.
 */
export async function resolveAgent(address: string, chain?: Chain): Promise<AgentIdentity[]> {
  return defaultClient.resolveAgent(address, chain);
}

/**
 * Get full agent verification + trust score from SAID.
 */
export async function verifyAgent(wallet: string): Promise<AgentIdentity | null> {
  return defaultClient.verifyAgent(wallet);
}

/**
 * Fetch A2A-compliant agent card for a SAID-registered agent.
 */
export async function getAgentCard(wallet: string): Promise<AgentCard | null> {
  return defaultClient.getAgentCard(wallet);
}

/**
 * Send a cross-chain message between agents.
 */
export async function sendMessage(msg: CrossChainMessage): Promise<MessageResult> {
  return defaultClient.sendMessage(msg);
}

/**
 * Get inbox messages for an agent (cross-chain).
 */
export async function getInbox(chain: Chain, address: string, limit = 20): Promise<unknown> {
  return defaultClient.getInbox(chain, address, limit);
}

/**
 * Check free tier usage for an address.
 */
export async function getFreeTierStatus(address: string): Promise<PaymentConfig> {
  return defaultClient.getFreeTierStatus(address);
}

/**
 * Discover agents across chains.
 */
export async function discoverAgents(query: DiscoveryQuery = {}): Promise<DiscoveryResult> {
  return defaultClient.discoverAgents(query);
}

/**
 * Get cross-chain registry stats.
 */
export async function getStats(): Promise<SAIDStats> {
  return defaultClient.getStats();
}

/**
 * Get list of supported chains.
 */
export async function getChains(): Promise<{ chains: Chain[]; count: number }> {
  return defaultClient.getChains();
}

/**
 * Evaluate whether an agent should be allowed to send a message.
 */
export async function evaluateTrustGate(
  senderAddress: string,
  config: TrustGateConfig = {}
): Promise<TrustGateResult> {
  return defaultClient.evaluateTrustGate(senderAddress, config);
}
