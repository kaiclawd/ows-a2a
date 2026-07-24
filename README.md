# SAID Protocol × Open Wallet Standard

**Identity-Gated Communication + Enforcement for AI Agent Wallets**

---

## The Problem

OWS gives agents wallets. [ows-policy](https://github.com/SAID-Protocol/ows-policy) gates what they can **spend**.

But agents also need to **talk to each other** — and communication without identity and enforcement is dangerous:

- **Spam and phishing** — anonymous agents flood inboxes with zero cost
- **No trust signal** — a message from a verified agent and a scam bot look identical
- **No enforcement** — slashed bad actors can keep messaging
- **No cross-chain** — agents on Solana can't reach agents on Base or Ethereum
- **No payment rail** — no way to monetize agent services or rate-limit abuse

**OWS gives agents wallets. SAID gives agents identity + enforcement. This gives agents secure communication.**

---

## What's New in v2.0

**On-chain enforcement data.** The library now exposes SAID's staking/slashing data — the only economic enforcement layer for AI agents on Solana.

| Feature | v1.0 | v2.0 |
|---------|------|------|
| Agent resolution | ✅ | ✅ |
| Trust-gated messaging | ✅ | ✅ |
| x402 payment | ✅ | ✅ |
| **Enforcement data** (staking/slashing) | ❌ | ✅ |
| **Risk assessment** (accept/review/reject) | ❌ | ✅ |
| **Block slashed agents** | ❌ | ✅ |
| **Minimum stake requirement** | ❌ | ✅ |
| **Retry with backoff** | ❌ | ✅ |
| **Real test suite** | ❌ (demo as test) | ✅ (22 tests) |

---

## Installation

```bash
npm install said-ows-a2a
```

---

## Quick Start

### Check Enforcement Status

```typescript
import { getEnforcement } from "said-ows-a2a";

const enforcement = await getEnforcement("4yNvq...");
// → { staked: true, stakeAmountSOL: 5.2, slashed: false, slashCount: 0, enforcementTier: "economic" }
```

### Get Risk Assessment (Marketplace Verdict)

```typescript
import { getRiskAssessment } from "said-ows-a2a";

const risk = await getRiskAssessment("4yNvq...");
// → {
//   score: 72, tier: "gold", verified: true,
//   riskLevel: "low", verdict: "accept",
//   escrowPct: 0, spendCap: 10000,
//   staked: true, stakeAmountSOL: 5.2,
//   slashed: false, slashCount: 0
// }
```

### Gate Messages by Trust + Enforcement

```typescript
import { evaluateTrustGate } from "said-ows-a2a";

// v2.0: Block slashed agents, require 1 SOL stake
const gate = await evaluateTrustGate(senderWallet, {
  requireVerified: true,
  minSenderScore: 50,
  blockSlashed: true,      // 🆕 Reject slashed agents
  minStakeSOL: 1,          // 🆕 Require economic skin-in-the-game
  blockAnonymous: true,
});

if (!gate.allowed) {
  console.log(`Blocked: ${gate.reason}`);
}
```

### Send a Cross-Chain Message

```typescript
import { sendMessage } from "said-ows-a2a";

const result = await sendMessage({
  from: { address: "4yNvq...", chain: "solana" },
  to: { address: "0x1234...", chain: "base" },
  message: "Execute trade: swap 100 USDC for SOL",
  context: { action: "trade", amount: 100 },
});
```

### Discover Verified Agents

```typescript
import { discoverAgents } from "said-ows-a2a";

const result = await discoverAgents({
  verified: true,
  capability: "trading",
  chains: ["solana", "base"],
  limit: 50,
});
```

---

## API Reference

### Agent Resolution
| Function | Description |
|----------|-------------|
| `resolveAgent(address, chain?)` | Resolve any wallet to agent identities across 10 chains |
| `verifyAgent(wallet)` | Get full SAID verification + trust score breakdown |
| `getAgentCard(wallet)` | Fetch A2A-compliant agent card |

### Enforcement (v2.0)
| Function | Description |
|----------|-------------|
| `getEnforcement(wallet)` | On-chain staking/slashing status |
| `getRiskAssessment(wallet)` | Full risk assessment with marketplace verdict |

### Messaging
| Function | Description |
|----------|-------------|
| `sendMessage(msg)` | Cross-chain A2A message (x402-gated) |
| `getInbox(chain, address, limit?)` | Fetch agent inbox |
| `getFreeTierStatus(address)` | Check x402 free tier usage |

### Discovery
| Function | Description |
|----------|-------------|
| `discoverAgents(query)` | Search agents across chains |
| `getStats()` | Cross-chain registry stats |

### Trust Gate
| Function | Description |
|----------|-------------|
| `evaluateTrustGate(address, config)` | Check if agent should be allowed to communicate |

**TrustGateConfig options:**
- `minSenderScore` — minimum trust score (0-100)
- `requireVerified` — require SAID verification
- `blockAnonymous` — block unregistered addresses
- `blockSlashed` — 🆕 reject agents that have been slashed on-chain
- `minStakeSOL` — 🆕 require minimum SOL staked

---

## The Full OWS Agent Stack

| Layer | Module | What it gates |
|-------|--------|---------------|
| **Wallet** | OWS | Key management, signing |
| **Spending** | [ows-policy](https://github.com/SAID-Protocol/ows-policy) | Transaction limits by trust tier |
| **Communication** | **ows-a2a** (this repo) | Messaging by trust + enforcement |

Together: agents that can hold money AND talk to each other, with trust scores AND economic enforcement governing both what they spend and who they communicate with.

---

## Supported Chains

Solana, Ethereum, Base, Arbitrum, Avalanche, Optimism, Polygon, Celo, Gnosis, BNB

---

## Live Infrastructure

- **API:** [api.saidprotocol.com](https://api.saidprotocol.com)
- **Program:** `5dpw6KEQPn248pnkkaYyWfHwu2nfb3LUMbTucb6LaA8G`
- **6,700+ registered agents** | **94%+ verified**
- **x402 payment** (Linux Foundation standard)

---

## License

MIT
