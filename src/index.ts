export {
  resolveAgent,
  verifyAgent,
  getEnforcement,
  getUnifiedTrust,
  getAgentCard,
  sendMessage,
  getInbox,
  getFreeTierStatus,
  discoverAgents,
  getStats,
  evaluateTrustGate,
  SUPPORTED_CHAINS,
  PAYMENT_NETWORKS,
  // Preset policies
  STRICT_POLICY,
  BALANCED_POLICY,
  PERMISSIVE_POLICY,
  MARKETPLACE_POLICY,
  MAXIMUM_SECURITY_POLICY,
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
  EnforcementData,
  UnifiedTrustResult,
} from "./types";

export type {
  TrustGateConfig,
  TrustGateResult,
} from "./client";
