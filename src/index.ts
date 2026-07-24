export {
  resolveAgent,
  verifyAgent,
  getAgentCard,
  getEnforcement,
  getRiskAssessment,
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
  EnforcementStatus,
  SlashEvent,
  RiskAssessment,
} from "./types";

export type { TrustGateConfig } from "./client";
