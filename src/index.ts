export {
  resolveAgent,
  verifyAgent,
  getAgentCard,
  sendMessage,
  getInbox,
  getFreeTierStatus,
  discoverAgents,
  getStats,
  evaluateTrustGate,
  SUPPORTED_CHAINS,
  PAYMENT_NETWORKS,
} from "./client";

export type {
  Chain,
  RegistrySource,
  AgentIdentity,
  AgentCard,
  CrossChainMessage,
  MessageResult,
  PaymentConfig,
  DiscoveryQuery,
  DiscoveryResult,
} from "./types";

export type { TrustGateConfig } from "./client";
