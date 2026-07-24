# Changelog

All notable changes to SAID OWS A2A will be documented in this file.

## [2.0.0] — 2026-07-24

### Added
- **Enforcement data**: `getEnforcement(wallet)` returns on-chain staking/slashing status
- **Risk assessment**: `getRiskAssessment(wallet)` returns marketplace-ready verdict (accept/review/reject), escrow %, spend caps
- **Enforcement-aware trust gate**: `evaluateTrustGate()` now supports `blockSlashed` and `minStakeSOL` options
- **Retry with exponential backoff**: All API calls retry on 5xx errors (2 retries, 500ms backoff)
- **Request timeout**: All API calls have a 10s abort timeout
- **Real integration tests**: 22 tests against live SAID API (replaces demo-as-test hack)
- **CI/CD**: GitHub Actions (Node 20+22 matrix), npm auto-publish on release
- **Types**: `EnforcementStatus`, `SlashEvent`, `RiskAssessment` interfaces

### Changed
- Version: 1.0.0 → 2.0.0
- Trust gate now checks enforcement data when `blockSlashed` or `minStakeSOL` is set
- `SAID_API_URL` environment variable support (defaults to api.saidprotocol.com)

### Fixed
- `npm test` no longer runs the demo script — has a real test suite
- Missing `demo:discover` script reference removed (was pointing to nonexistent file)

## [1.0.0] — 2026-04-04

Initial release for Open Wallet Standard Hackathon.

- Cross-chain agent resolution (Solana + 9 EVM chains)
- Identity-gated messaging with x402 micropayments
- Trust gate (minScore, requireVerified, blockAnonymous)
- Agent discovery + stats
- Free tier status checking
- Demo script
