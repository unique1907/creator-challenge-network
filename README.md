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
2. Challenge brief domain model
3. Creator submission workflow
4. Reviewer scoring and approval workflow
5. Sponsor payout review
6. Circle Wallets payout orchestration
7. Public challenge pages and creator reputation profiles
8. Production hardening, audit trail, and deployment

## Repository

Official GitHub repository:

https://github.com/unique1907/creator-challenge-network

## License

Hackathon prototype. Licensing to be finalized before production release.
