# Changelog

All notable changes to SAID OWS A2A will be documented in this file.

## [2.1.0] — 2026-07-24

### Added
- **Enforcement data**: `getEnforcement(wallet)` queries SAID's on-chain staking/slashing status via `/api/enforcement/:wallet`. Returns staked amount (SOL), slash count, slash history, enforcement tier.
- **Risk assessment**: `getRiskAssessment(wallet)` combines trust score + enforcement data into marketplace-ready verdict (`accept`/`review`/`reject`), recommended escrow percentage, and spend caps.
- **Enforcement-aware trust gate**: `evaluateTrustGate()` now queries real on-chain enforcement data when `blockSlashed` or `minStakeSOL` is set (previously just checked tier name string).
- **Cache invalidation**: `invalidate()` now clears enforcement and risk assessment cache entries.
- **New types**: `EnforcementStatus`, `SlashEvent`, `RiskAssessment`.
- **6 new tests**: enforcement status, risk assessment, enforcement-aware trust gate.

### Changed
- Trust gate `blockSlashed` now uses REAL on-chain enforcement data (was checking tier name string — now queries `/api/enforcement/:wallet` for actual slashing history).
- Version: 2.0.0 → 2.1.0

## [2.0.0] — 2026-07-21

### Added
- Caching with TTL (5 min default, configurable via `createClient()`)
- Retry with exponential backoff on 429/5xx errors
- `createClient()` factory with configurable `apiBase`, `cacheTtlMs`, `maxRetries`
- `getChains()` function with API + fallback
- Dual CJS/ESM build via tsup
- Jest test suite (19 tests, live API integration)
- Proper TypeScript strict typing throughout
- `TrustGateResult`, `SAIDStats` interfaces

## [1.0.0] — 2026-04-04

Initial release for Open Wallet Standard Hackathon.

- Cross-chain agent resolution (Solana + 9 EVM chains)
- Identity-gated messaging with x402 micropayments
- Trust gate (minScore, requireVerified, blockAnonymous)
- Agent discovery + stats
- Free tier status checking
