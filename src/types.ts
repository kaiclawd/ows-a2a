/**
 * SAID A2A Communication Types
 * Identity-gated agent-to-agent messaging for OWS wallets
 */

// ── Chains ─────────────────────────────────────────────

export type Chain =
  | "solana"
  | "ethereum"
  | "base"
  | "arbitrum"
  | "avalanche"
  | "optimism"
  | "polygon"
  | "celo"
  | "gnosis"
  | "bnb";

export type RegistrySource = "said" | "erc8004";

// ── Agent Identity ─────────────────────────────────────

export interface AgentIdentity {
  address: string;
  chain: Chain;
  source: RegistrySource;
  name: string;
  description: string;
  capabilities: string[];
  endpoint?: string;
  verified: boolean;
  reputationScore: number;
  trustScore?: {
    score: number;
    tier: string;
    badges: string[];
    identity: number;
    activity: number;
    economic: number;
    ecosystem: number;
    longevity: number;
    fairscale: number;
  };
  registeredAt?: string;
}

// ── Enforcement (Economic Trust) ──────────────────────

/** On-chain staking and slashing data — SAID's unique differentiator */
export interface EnforcementData {
  /** Whether the agent has staked SOL as collateral */
  staked: boolean;
  /** Whether the agent has been slashed (penalized for misbehavior) */
  slashed: boolean;
  /** Number of slashing events */
  slashCount: number;
  /** Enforcement tier: 'gold' | 'silver' | 'bronze' | 'none' */
  enforcementTier: string;
  /** Stake account PDA address */
  stakePda?: string;
  /** Amount staked in SOL */
  stakeAmountSOL?: number;
  /** Last slash slot number */
  lastSlashSlot?: number;
}

// ── Unified Trust (Identity + Enforcement) ────────────

/** Combined identity verification + economic enforcement verdict */
export interface UnifiedTrustResult {
  wallet: string;
  /** Agent identity (null if not registered) */
  identity: AgentIdentity | null;
  /** Enforcement data (null if API unavailable) */
  enforcement: EnforcementData | null;
  /** Overall trust verdict */
  verdict: 'trusted' | 'provisional' | 'insufficient_evidence' | 'untrusted';
  /** Whether the agent has real economic skin-in-the-game */
  hasSkinInGame: boolean;
  /** Recommended maximum transaction value in USDC */
  maxTxValueUSDC: number;
  /** Recommended escrow percentage based on trust level */
  recommendedEscrowPct: number;
  /** Human-readable insight */
  insight: string;
}

// ── Agent Card (A2A Discovery) ─────────────────────────

export interface AgentCard {
  name: string;
  description: string;
  url: string;
  version: string;
  provider: {
    organization: string;
    url: string;
  };
  capabilities: {
    streaming: boolean;
    pushNotifications: boolean;
  };
  skills: Array<{
    id: string;
    name: string;
    description: string;
  }>;
  authentication: {
    schemes: string[];
    required: boolean;
  };
  said?: {
    verified: boolean;
    wallet: string;
    reputationScore: number;
    trustTier: string;
    registeredAt: string;
  };
}

// ── Messaging ──────────────────────────────────────────

export interface CrossChainMessage {
  from: { address: string; chain: Chain };
  to: { address: string; chain: Chain };
  message: string;
  context?: Record<string, any>;
}

export interface MessageResult {
  success: boolean;
  messageId?: string;
  status: "delivered" | "stored" | "payment_required" | "denied";
  deliveredVia?: string[];
  paid: boolean;
  from?: AgentIdentity;
  to?: AgentIdentity;
  trustGate?: {
    senderTier: string;
    senderScore: number;
    senderVerified: boolean;
    senderStaked?: boolean;
    senderSlashed?: boolean;
    recipientTier: string;
  };
  error?: string;
}

// ── Payment ────────────────────────────────────────────

export interface PaymentConfig {
  price: string;
  currency: string;
  treasury: string;
  network: string;
  protocol: "x402";
  freeTier: {
    messagesPerDay: number;
    used: number;
    remaining: number;
  };
}

// ── Discovery ──────────────────────────────────────────

export interface DiscoveryQuery {
  chains?: Chain[];
  capability?: string;
  verified?: boolean;
  minTrustScore?: number;
  limit?: number;
}

export interface DiscoveryResult {
  agents: AgentIdentity[];
  count: number;
  chains: string[];
}
