# Creator Challenge Network

Creator Challenge Network (CCN) is a hackathon project for launching creator challenges, validating proof-of-work submissions, and preparing wallet-native reward settlement on Arc with Circle Wallets.

This repository is the official CCN application. The earlier Circle bootstrap project was used only to validate wallet operations and is intentionally not part of this codebase.

## Vision

CCN turns creator campaigns into a transparent challenge economy. Sponsors define briefs and rewards, creators submit verifiable work, reviewers validate outcomes, and approved rewards move toward programmable USDC settlement.

The long-term goal is a creator network where reputation, challenge history, review decisions, and payouts are auditable without making the product feel like infrastructure.

## Current Progress

Sprint 0 validated the technical path:

- Circle Developer-Controlled Wallets setup completed outside this repo.
- Arc Testnet wallet creation and test USDC transfer were verified.
- The official GitHub repository was initialized.
- A Next.js 16 foundation was pushed.

Sprint 1 prepares the repository for long-term development:

- Scalable folder architecture.
- Clear app, feature, service, hook, utility, and type boundaries.
- Updated documentation for contributors and hackathon reviewers.

Sprint 2 creates the first public product experience:

- Premium dark landing page for the DeFi / Programmable Money track.
- Public challenge listing route with realistic mock brand challenges.
- Public challenge detail route with reward, deadline, usage-rights, submissions, status, and Arc escrow context.
- Responsive header and footer for the public experience.
- Mock data only; no database, authentication, wallet calls, smart contracts, or secrets.

Sprint 3 and Sprint 4 validate the wallet-native funding path:

- Internal-only Circle User-Controlled Wallet spike completed for a CCN-authenticated test account.
- Arc Testnet balance verification and official test USDC detection completed.
- Single non-upgradeable `CCNEscrow` contract deployed to Arc Testnet.
- First real Brand funding flow verified with exact USDC approval and escrow funding.

## Arc Testnet Verification

- Chain ID: `5042002`
- Official Arc Testnet USDC: `0x3600000000000000000000000000000000000000`
- CCNEscrow contract: `0x571470097882848441f8d7FD3D0A37B1b726eBF6`
- Deployment transaction: `0xfd01e623896253221bc4724b42fb26d6d041dac41f25b47520d53bbd5c02b4a7`
- First verified approval transaction: `0xbdbedd9348982017207f2727451cc9119f4e092fbec864fd0c7752ba9fea6e23`
- First verified funding transaction: `0x1f2ffbe8b5166dc7a472fba5fbd7c61f2c5921bc6ca310d1f38466d162b52c74`
- Prize pool locked: `10` test USDC
- Platform fee locked: `0.10` test USDC
- Total locked: `10.10` test USDC

These values are public testnet facts only. Operational wallet identifiers,
Circle user identifiers, local funding intent IDs, API keys, Entity Secrets,
PINs, recovery data, and local state are intentionally excluded from this
repository.

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- ESLint 9
- npm

## Architecture

```text
src/
  app/          Next.js App Router routes, metadata, and global styles only
  components/   Shared reusable UI primitives and layout components
  features/     Product feature slices with local components, data, and logic
  hooks/        Shared React hooks
  lib/          Framework adapters and low-level project libraries
  services/     External service clients and API integration modules
  types/        Shared domain and API TypeScript types
  utils/        Small pure helpers with no framework or service coupling
public/         Static assets served by Next.js
```

### Boundary Rules

- Keep route files in `src/app` thin.
- Put feature-specific UI and data under `src/features/<feature-name>`.
- Put shared UI in `src/components`.
- Put external integrations in `src/services`, not inside route components.
- Put reusable domain types in `src/types`.
- Do not commit secrets, wallet state, Entity Secrets, or API keys.

## Getting Started

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Run lint checks:

```bash
npm run lint
```

Build for production:

```bash
npm run build
```

## Environment Policy

Local environment files are ignored by default:

- `.env`
- `.env.local`
- `.env.development`
- `.env.production`

Circle API keys, Entity Secrets, wallet IDs, and operational credentials must stay outside source control.

## Roadmap

1. Foundation architecture and contributor-ready repository
2. Public challenge discovery and detail pages
3. Challenge brief domain model
4. Creator submission workflow
5. Blind brand review and winner selection
6. Sponsor payout review
7. Circle Wallets payout orchestration
8. Public creator reputation profiles
9. Production hardening, audit trail, and deployment

## Repository

Official GitHub repository:

https://github.com/unique1907/creator-challenge-network

## License

Hackathon prototype. Licensing to be finalized before production release.
