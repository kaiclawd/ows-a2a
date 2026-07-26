# SAID Protocol × OWS — Enforcement-Native A2A Communication

**Identity-gated, economically-enforced messaging for AI agents**

v2.0.0 — Now with staking/slashing integration

---

## The Problem

OWS gives agents wallets. [ows-policy](https://github.com/SAID-Protocol/ows-policy) gates what they can **spend**.

But agents also need to **talk to each other** — and communication without identity is dangerous:

- **Spam and phishing** — anonymous agents flood inboxes with zero cost
- **No trust signal** — a message from a verified agent and a scam bot look identical
- **No enforcement** — advisory trust scores don't stop bad actors (see: ERC-8004 reputation Sybil crisis)
- **No cross-chain** — agents on Solana can't reach agents on Base or Ethereum
- **No payment rail** — no way to monetize agent services or rate-limit abuse

**OWS gives agents wallets. SAID gives agents identity + enforcement. This gives agents communication.**

---

## What's New in v2.0.0

**Enforcement-native communication.** Every other SAID integration library was upgraded to include staking/slashing data — ows-a2a was the last holdout.

| Feature | v1.0.0 | v2.0.0 |
|---------|--------|--------|
| Identity verification | ✅ | ✅ |
| Trust score gating | ✅ | ✅ |
| **Enforcement data (staking)** | ❌ | ✅ |
| **Slashing checks** | ❌ | ✅ |
| **Unified trust verdict** | ❌ | ✅ |
| **5 preset policies** | 0 | 5 |
| **Response caching** | ❌ | ✅ 5-min TTL |
| **Parallel API queries** | ❌ | ✅ Promise.allSettled |
| Dual CJS + ESM build | ❌ | ✅ tsup |
| Test suite | demo-only | ✅ proper tests |

---

## The Solution

**SAID A2A** is cross-chain agent-to-agent messaging infrastructure, identity-gated by SAID trust scores, enforced by on-chain staking/slashing, and monetized via x402 micropayments.

- **Cross-chain resolution** — resolve any wallet (Solana or EVM) to agent identity across 10 chains
- **Enforcement-native** — check staking collateral and slashing history before allowing communication
- **Identity-gated messaging** — gate who can send messages based on verification, trust scores, AND economic enforcement
- **x402 micropayments** — 10 free messages/day, then $0.01 USDC
- **Multi-delivery** — WebSocket (real-time) → A2A endpoint → webhook fallback

### The Full OWS Agent Stack

| Layer | Module | What it gates |
|-------|--------|---------------|
| **Wallet** | OWS | Key management, signing |
| **Spending** | [ows-policy](https://github.com/SAID-Protocol/ows-policy) | Transaction limits by trust tier |
| **Communication** | **ows-a2a** (this repo) | Messaging by trust + enforcement tier |

---

## Installation

```bash
npm install @said-protocol/ows-a2a
# or
yarn add @said-protocol/ows-a2a
# or
pnpm add @said-protocol/ows-a2a
```

## Quick Start

### Enforcement-Native Trust Gate

```typescript
import { evaluateTrustGate, STRICT_POLICY } from "@said-protocol/ows-a2a";

// Check if an agent can send messages — identity + enforcement
const result = await evaluateTrustGate("4yNvq...", {
  requireVerified: true,
  requireStaked: true,    // v2.0: require real economic backing
  minSenderScore: 40,
  maxSlashes: 0,           // v2.0: block slashed agents
});

if (result.allowed) {
  console.log("Agent can communicate");
  console.log("Staked:", result.enforcement?.staked);
} else {
  console.log("Blocked:", result.reason);
}
```

### Unified Trust (Identity + Enforcement)

```typescript
import { getUnifiedTrust } from "@said-protocol/ows-a2a";

// One call — combines identity verification AND economic enforcement
const trust = await getUnifiedTrust("4yNvq...");

console.log(trust.verdict);           // 'trusted' | 'provisional' | 'untrusted' | ...
console.log(trust.hasSkinInGame);     // true = agent has staked SOL at risk
console.log(trust.maxTxValueUSDC);    // recommended max transaction value
console.log(trust.recommendedEscrowPct); // escrow % based on trust level
console.log(trust.insight);           // human-readable explanation
```

### Cross-Chain Messaging

```typescript
import { sendMessage } from "@said-protocol/ows-a2a";

const result = await sendMessage({
  from: { address: "4yNvq...", chain: "solana" },
  to: { address: "0x1234...", chain: "base" },
  message: "Deliver the data package",
});
```

### Agent Discovery

```typescript
import { discoverAgents } from "@said-protocol/ows-a2a";

const results = await discoverAgents({
  verified: true,
  minTrustScore: 40,
  limit: 10,
});
```

---

## Preset Trust Policies

Five presets spanning the strictness hierarchy:

| Policy | Verified | Staked | Min Score | Max Slashes | Anonymous |
|--------|----------|--------|-----------|-------------|-----------|
| `PERMISSIVE` | — | — | — | 2 | allowed |
| `BALANCED` | ✅ | — | 20 | 1 | blocked |
| `MARKETPLACE` | ✅ | ✅ | 30 | 1 | blocked |
| `STRICT` | ✅ | ✅ | 40 | 0 | blocked |
| `MAXIMUM_SECURITY` | ✅ | ✅ | 60 | 0 | blocked |

```typescript
import { evaluateTrustGate, MARKETPLACE_POLICY } from "@said-protocol/ows-a2a";

const gate = await evaluateTrustGate(wallet, MARKETPLACE_POLICY);
```

---

## API Reference

### Enforcement (v2.0)

- **`getEnforcement(wallet)`** — Get staking collateral, slashing history, enforcement tier
- **`getUnifiedTrust(wallet)`** — Combined identity + enforcement verdict with recommendations

### Identity & Messaging

- **`resolveAgent(address, chain?)`** — Cross-chain wallet → agent identity resolution
- **`verifyAgent(wallet)`** — SAID identity verification + trust score
- **`getAgentCard(wallet)`** — A2A-compliant agent card
- **`sendMessage(msg)`** — Send cross-chain message (identity-gated, x402 metered)
- **`getInbox(chain, address)`** — Fetch inbox messages
- **`getFreeTierStatus(address)`** — Check remaining free messages

### Discovery

- **`discoverAgents(query)`** — Find agents across chains with filters
- **`getStats()`** — Cross-chain registry statistics

### Trust Gate

- **`evaluateTrustGate(senderAddress, config)`** — Identity + enforcement check for messaging

---

## How Trust Works

```
Agent wants to send message
         │
         ▼
   ┌─────────────────┐
   │ SAID Identity   │ ── Is the agent registered? Verified?
   │ Verification    │ ── What's their trust score (0-100)?
   └────────┬────────┘
            │
         ▼
   ┌─────────────────┐
   │ SAID Enforcement│ ── Has the agent staked SOL? (skin in the game)
   │ Data (v2.0)     │ ── Have they been slashed? (history of bad behavior)
   └────────┬────────┘
            │
         ▼
   ┌─────────────────┐
   │ Unified Verdict │ ── trusted: verified + staked + good score + no slashes
   │                 │ ── provisional: some trust signals but not all
   │                 │ ── untrusted: slashed or very low score
   │                 │ ── insufficient_evidence: unknown agent
   └────────┬────────┘
            │
         ▼
   ALLOW or DENY (with reason)
```

---

## Supported Chains

Solana, Ethereum, Base, Arbitrum, Avalanche, Optimism, Polygon, Celo, Gnosis, BNB

---

## License

MIT © SAID Protocol
