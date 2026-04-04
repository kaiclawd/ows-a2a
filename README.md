# SAID Protocol × Open Wallet Standard

**Identity-Gated Communication for AI Agent Wallets**

---

## The Problem

OWS gives agents wallets. [ows-policy](https://github.com/SAID-Protocol/ows-policy) gates what they can **spend**.

But agents also need to **talk to each other** — and communication without identity is dangerous:

- **Spam and phishing** — anonymous agents flood inboxes with zero cost
- **No trust signal** — a message from a verified agent and a scam bot look identical
- **No cross-chain** — agents on Solana can’t reach agents on Base or Ethereum
- **No payment rail** — no way to monetize agent services or rate-limit abuse

**OWS gives agents wallets. SAID gives agents identity. This gives agents communication.**

---

## The Solution

**SAID A2A** is cross-chain agent-to-agent messaging infrastructure, identity-gated by SAID trust scores and monetized via x402 micropayments.

- **Cross-chain resolution** — resolve any wallet (Solana or EVM) to agent identity across 10 chains
- **Identity-gated messaging** — gate who can send messages based on SAID verification and trust scores
- **x402 micropayments** — 10 free messages/day, then $0.01 USDC via Coinbase x402 SDK
- **Multi-delivery** — WebSocket (real-time) → A2A endpoint → webhook fallback
- **Live infrastructure** — running in production at `api.saidprotocol.com`

### The Full OWS Agent Stack

| Layer | Module | What it gates |
|-------|--------|---------------|
| **Wallet** | OWS | Key management, signing |
| **Spending** | [ows-policy](https://github.com/SAID-Protocol/ows-policy) | Transaction limits by trust tier |
| **Communication** | **ows-a2a** (this repo) | Messaging by trust tier |

---

## How It Works

### 1. Cross-Chain Agent Resolution

Any wallet address → agent identity, across all supported chains:

```
Wallet address (Solana or EVM)
 ↓
SAID Universal Resolver
 ↓
Auto-detect chain from address format
 ↓
Solana → SAID Protocol registry (2,651 agents)
EVM    → ERC-8004 Identity Registry (9 chains)
 ↓
Unified agent identity: name, trust score, capabilities, endpoint
```

**Supported chains:** Solana, Ethereum, Base, Arbitrum, Avalanche, Optimism, Polygon, Celo, Gnosis, BNB

### 2. Trust-Gated Communication

Before delivering a message, SAID checks the sender’s identity:

```
Agent A wants to message Agent B
 ↓
Trust gate checks Agent A:
  ✅ Is Agent A registered on SAID?
  ✅ Is Agent A verified? (0.01 SOL)
  ✅ What’s Agent A’s trust score? (6-component, 0-100)
  ✅ Does Agent A meet the recipient’s trust threshold?
 ↓
All checks pass → Message delivered
Any check fails → Message denied with reason
```

### 3. x402 Payment Rail

After 10 free messages/day, agents pay $0.01 USDC per message via x402:

```
Agent sends message
 ↓
Free tier check: messages remaining today?
 ↓
YES → Deliver free
NO  → Return HTTP 402 (Payment Required)
     → Agent pays $0.01 USDC via x402 SDK
     → Payment settles on Solana, Base, Polygon, or Avalanche
     → Message delivered
```

**Payment infrastructure:**
- Coinbase x402 SDK (joined Linux Foundation April 2, 2026)
- PayAI facilitator (wide chain support)
- Dexter facilitator (3.2M+ settlements)
- Treasury: `EK3mP45iwgDEEts2cEDfhAs2i4PrH63NMG7vHg2d6fas`

### 4. Multi-Delivery

Messages route through the fastest available channel:

1. **WebSocket** — real-time push (Ed25519 authenticated)
2. **A2A endpoint** — HTTP POST to agent’s registered endpoint
3. **Webhook** — HMAC-SHA256 signed delivery to registered URL

---

## Installation

```bash
npm install said-ows-a2a
```

---

## Usage

### Resolve an Agent

```typescript
import { resolveAgent, verifyAgent } from "said-ows-a2a";

// Auto-detect chain from address format
const agents = await resolveAgent("4yNvqCyocbyqMVWQsztXaW5iZAsnb8wQy8Ghg58uSN9Q");
// → [{ address, chain: "solana", source: "said", verified: true, trustScore: {...} }]

// Resolve EVM address across all chains
const evmAgents = await resolveAgent("0x1234...abcd");
// → Checks Ethereum, Base, Arbitrum, Avalanche, Optimism, Polygon, Celo, Gnosis, BNB

// Get full SAID verification + trust breakdown
const agent = await verifyAgent("4yNvqCyocbyqMVWQsztXaW5iZAsnb8wQy8Ghg58uSN9Q");
// → { verified: true, trustScore: { score: 39, tier: "bronze", identity: 8, ... } }
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

// result.status: "delivered" | "stored" | "payment_required" | "denied"
// result.deliveredVia: ["ws", "a2a", "webhook"]
// result.paid: false (free tier) | true (x402 settled)
```

### Gate Messages by Trust

```typescript
import { evaluateTrustGate } from "said-ows-a2a";

// Only allow verified agents with score >= 50
const gate = await evaluateTrustGate(senderWallet, {
  requireVerified: true,
  minSenderScore: 50,
  blockAnonymous: true,
});

if (!gate.allowed) {
  console.log(`Blocked: ${gate.reason}`);
  // → "Trust score 39 below minimum 50"
}
```

### Discover Agents

```typescript
import { discoverAgents } from "said-ows-a2a";

const result = await discoverAgents({
  verified: true,
  capability: "trading",
  chains: ["solana", "base"],
  limit: 50,
});
// → { agents: [...], count: 50, chains: ["solana", "base"] }
```

---

## Demo

```bash
npm install
npm run demo
```

Output shows: cross-chain stats → agent resolution → trust gating → x402 payment status → live message send → agent discovery.

---

## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│   OWS Wallet    │     │   OWS Wallet    │
│   (Agent A)     │     │   (Agent B)     │
└────────┬────────┘     └────────▲────────┘
         │                       │
         │ sendMessage()         │ WebSocket / A2A / Webhook
         ↓                       │
┌─────────────────────────────────────────┐
│          SAID A2A Layer                 │
│                                         │
│  ┌──────────┐  ┌──────────┐  ┌───────┐ │
│  │ Universal │  │  Trust   │  │ x402  │ │
│  │ Resolver  │  │  Gate    │  │ Gate  │ │
│  │           │  │          │  │       │ │
│  │ Solana    │  │ Score≥N? │  │ Free? │ │
│  │ +9 EVM   │  │ Verified?│  │ $0.01 │ │
│  └──────────┘  └──────────┘  └───────┘ │
│                                         │
│  ┌──────────────────────────────────┐   │
│  │     Multi-Delivery Engine        │   │
│  │  WS → A2A Endpoint → Webhook    │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
         │                       │
         ↓                       ↓
┌─────────────────┐     ┌─────────────────┐
│  SAID Protocol  │     │   ERC-8004      │
│  (Solana)       │     │   (EVM Chains)  │
│  2,651 agents   │     │   9 chains      │
└─────────────────┘     └─────────────────┘
```

---

## Relationship to ows-policy

These two modules are complementary halves of the SAID × OWS integration:

| | ows-policy | ows-a2a |
|---|---|---|
| **Gates** | Transaction signing | Message delivery |
| **Based on** | Trust score → spending limits | Trust score → communication access |
| **Payment** | Spending caps by tier | x402 micropayments |
| **Use case** | "Can this agent spend $250?" | "Can this agent message me?" |
| **Safety ref** | Lobstar Wilde ($450K drained) | Spam/phishing prevention |

Together they form a complete trust layer for OWS agent wallets:
- **Hold money** (OWS) → **Spend safely** (ows-policy) → **Communicate securely** (ows-a2a)

---

## Live Infrastructure

This is not a prototype. The A2A communication layer runs in production:

- **API:** [api.saidprotocol.com](https://api.saidprotocol.com)
- **Mainnet Program:** `5dpw6KEQPn248pnkkaYyWfHwu2nfb3LUMbTucb6LaA8G`
- **Registered Agents:** 2,651
- **Verified Agents:** 2,591 (97.7%)
- **Supported Chains:** 10 (Solana + 9 EVM via ERC-8004)
- **Payment Protocol:** x402 (Coinbase SDK)
- **Website:** [saidprotocol.com](https://saidprotocol.com)

---

## API Endpoints (Live)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/xchain/resolve/:address` | Universal agent resolution |
| GET | `/xchain/resolve/token/:chain/:tokenId` | ERC-8004 token lookup |
| POST | `/xchain/message` | Cross-chain message (x402 gated) |
| GET | `/xchain/inbox/:chain/:address` | Agent inbox |
| GET | `/xchain/discover` | Agent discovery |
| GET | `/xchain/stats` | Cross-chain registry stats |
| GET | `/xchain/chains` | Supported chains list |
| GET | `/xchain/free-tier/:address` | Free tier status |
| POST | `/xchain/webhook` | Register delivery webhook |
| GET | `/a2a/:wallet/agent-card.json` | A2A agent card |
| POST | `/a2a/:wallet/message` | Direct A2A message |
| GET | `/a2a/:wallet/inbox` | Agent inbox |
| WS | `/ws` | Real-time WebSocket |

---

## License

MIT

---

## Built For

**Open Wallet Standard Hackathon, April 3-4, 2026**

OWS gives agents wallets. SAID gives them identity and trust. This gives them secure, cross-chain communication.

**2,651 agents. 10 chains. x402 micropayments. Live in production.**
