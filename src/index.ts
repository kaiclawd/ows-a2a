export {
  // Client factory
  createClient,
  // Standalone functions (backwards-compatible v1 API)
  resolveAgent,
  verifyAgent,
  getAgentCard,
  sendMessage,
  getInbox,
  getFreeTierStatus,
  discoverAgents,
  getStats,
  getChains,
  evaluateTrustGate,
  getEnforcement,
  getRiskAssessment,
  // Constants
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
  SAIDStats,
  TrustGateConfig,
  TrustGateResult,
  EnforcementStatus,
  RiskAssessment,
  SlashEvent,
} from "./types";

export type { SAIDClientOptions } from "./client";
