# Creator Challenge Network

Creator Challenge Network (CCN) is a hackathon project for launching creator challenges, validating proof-of-work submissions, and preparing wallet-native reward settlement on Arc with Circle Wallets.

The current repository is the official production-ready foundation for the CCN application. The earlier Circle bootstrap work was used only to validate wallet operations and is intentionally not included here.

## Why CCN

Creator campaigns often fail at the handoff between creative output, review, and payment. CCN turns that flow into a clear operating system:

- Sponsors publish challenge briefs with reward rules.
- Creators submit proof-linked work.
- Reviewers approve outcomes against transparent criteria.
- Rewards move toward programmable USDC settlement after validation.

## Hackathon Scope

Sprint 0 focuses on the smallest useful proof:

- A polished Next.js 16 application foundation.
- A public repository with professional structure and documentation.
- A validated Arc Testnet and Circle Wallets path outside this repo.
- A roadmap toward creator submissions, review operations, and payout orchestration.

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- ESLint 9
- npm

## Project Structure

```text
src/
  app/          App Router routes, metadata, and global styles
  components/   Reusable UI building blocks
  data/         Static product and demo content
  lib/          Shared helpers
  types/        Domain TypeScript types
public/         Static assets
```

## Getting Started

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Run lint checks:

```bash
npm run lint
```

## Environment Policy

Do not commit secrets. Local environment files are ignored by default:

- `.env`
- `.env.local`
- `.env.development`
- `.env.production`

Circle API keys, Entity Secrets, wallet IDs, and other operational credentials must stay outside source control.

## Product Roadmap

1. Challenge brief creation
2. Creator submission intake
3. Reviewer scoring workflow
4. Sponsor payout approval
5. Circle Wallets payout orchestration
6. Public challenge and creator reputation pages

## Repository

Official GitHub repository:

https://github.com/unique1907/creator-challenge-network

## License

Hackathon prototype. Licensing to be finalized before production release.
