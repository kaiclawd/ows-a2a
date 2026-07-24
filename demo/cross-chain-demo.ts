import {
  verifyAgent,
  getFreeTierStatus,
  sendMessage,
  getStats,
  evaluateTrustGate,
  discoverAgents,
  SUPPORTED_CHAINS,
} from "../src";

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║  SAID Protocol × OWS: Identity-Gated A2A Communication   ║");
  console.log("║  Cross-chain messaging with x402 micropayments           ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log("");

  // ── 1. Cross-Chain Stats ─────────────────────────────
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("1. CROSS-CHAIN REGISTRY STATS");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");

  try {
    const stats = await getStats();
    console.log(`   Total agents: ${stats.totalAgents}`);
    console.log(`   Total chains: ${stats.totalChains}`);
    console.log(`   Supported: ${SUPPORTED_CHAINS.join(", ")}`);
    for (const [chain, info] of Object.entries(stats.chains)) {
      console.log(`   ${chain}: ${info.agents} agents (${info.source})`);
    }
  } catch (e: any) {
    console.log(`   (Stats unavailable: ${e.message})`);
  }
  console.log("");

  // ── 2. Resolve Agent Identity ────────────────────────
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("2. RESOLVE AGENT (Solana → SAID Identity)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");

  const testWallet = "4yNvqCyocbyqMVWQsztXaW5iZAsnb8wQy8Ghg58uSN9Q";

  try {
    const agent = await verifyAgent(testWallet);
    if (agent) {
      console.log(`   Wallet: ${agent.address}`);
      console.log(`   Name: ${agent.name}`);
      console.log(`   Verified: ${agent.verified ? "YES" : "NO"}`);
      console.log(`   Chain: ${agent.chain} (${agent.source})`);
      if (agent.trustScore) {
        console.log(`   Trust Score: ${agent.trustScore.score}/100 (${agent.trustScore.tier})`);
        console.log(`   Breakdown: identity=${agent.trustScore.identity} activity=${agent.trustScore.activity} economic=${agent.trustScore.economic} ecosystem=${agent.trustScore.ecosystem} longevity=${agent.trustScore.longevity}`);
        console.log(`   FairScale: ${agent.trustScore.fairscale}/30`);
      }
    } else {
      console.log(`   No SAID identity found for ${testWallet}`);
    }
  } catch (e: any) {
    console.log(`   (Resolution unavailable: ${e.message})`);
  }
  console.log("");

  // ── 3. Trust Gate Evaluation ─────────────────────────
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("3. TRUST GATE (Can this agent send messages?)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");

  // Strict gate: require verified + minimum score
  const strictGate = await evaluateTrustGate(testWallet, {
    requireVerified: true,
    minSenderScore: 20,
    blockAnonymous: true,
  });

  console.log(`   Strict gate (verified + score >= 20):`);
  console.log(`   ${strictGate.allowed ? "ALLOWED" : "DENIED"} ${strictGate.reason || ""}`);
  if (strictGate.agent?.trustScore) {
    console.log(`   Agent tier: ${strictGate.agent.trustScore.tier}`);
  }
  console.log("");

  // Anonymous agent gate
  const anonGate = await evaluateTrustGate("11111111111111111111111111111111", {
    blockAnonymous: true,
  });
  console.log(`   Anonymous gate (block unregistered):`);
  console.log(`   ${anonGate.allowed ? "ALLOWED" : "DENIED"} ${anonGate.reason || ""}`);
  console.log("");

  // ── 4. Free Tier Status ──────────────────────────────
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("4. x402 PAYMENT STATUS");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");

  try {
    const payment = await getFreeTierStatus(testWallet);
    console.log(`   Protocol: ${payment.protocol}`);
    console.log(`   Price: ${payment.price} ${payment.currency}/message`);
    console.log(`   Treasury: ${payment.treasury}`);
    console.log(`   Free tier: ${payment.freeTier.remaining}/${payment.freeTier.messagesPerDay} remaining today`);
    console.log(`   Payment chains: Solana, Base, Polygon, Avalanche`);
  } catch (e: any) {
    console.log(`   (Payment status unavailable: ${e.message})`);
  }
  console.log("");

  // ── 5. Cross-Chain Message ───────────────────────────
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("5. SEND CROSS-CHAIN MESSAGE (Solana → Solana)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");

  // Use a second known registered agent
  const recipientWallet = "72onvrQJZkPGLAhWK5MeYc73iyM72P2ABKzDMQ4NpQBL";

  try {
    const result = await sendMessage({
      from: { address: testWallet, chain: "solana" },
      to: { address: recipientWallet, chain: "solana" },
      message: "Hello from OWS hackathon demo — identity-gated A2A messaging",
      context: { demo: true, source: "ows-a2a-hackathon" },
    });

    if (result.success) {
      console.log(`   Message sent`);
      console.log(`   ID: ${result.messageId}`);
      console.log(`   Status: ${result.status}`);
      console.log(`   Delivered via: ${result.deliveredVia?.join(", ") || "stored"}`);
      console.log(`   Paid: ${result.paid ? "YES (x402)" : "NO (free tier)"}`);
    } else {
      console.log(`   Status: ${result.status}`);
      console.log(`   ${result.error || "Message not sent"}`);
    }
  } catch (e: any) {
    console.log(`   (Message send unavailable: ${e.message})`);
  }
  console.log("");

  // ── 6. Agent Discovery ───────────────────────────────
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("6. DISCOVER VERIFIED AGENTS (Cross-Chain)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");

  try {
    const discovered = await discoverAgents({
      verified: true,
      limit: 5,
    });
    console.log(`   Found ${discovered.count} verified agents`);
    for (const agent of discovered.agents.slice(0, 5)) {
      const name = agent.name?.substring(0, 20) || "Unnamed";
      console.log(`   ${agent.verified ? "V" : " "} ${name.padEnd(22)} ${agent.chain.padEnd(10)} score=${agent.reputationScore}`);
    }
  } catch (e: any) {
    console.log(`   (Discovery unavailable: ${e.message})`);
  }
  console.log("");

  // ── Summary ──────────────────────────────────────────
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("OWS gives agents wallets.");
  console.log("SAID gives agents identity, trust, and communication.");
  console.log("");
  console.log("  ows-policy  → identity-gated SIGNING (spend limits)");
  console.log("  ows-a2a     → identity-gated COMMUNICATION (messaging)");
  console.log("");
  console.log("Together: agents that can hold money AND talk to each other,");
  console.log("with trust scores governing both what they spend and who");
  console.log("they communicate with.");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main().catch(console.error);
