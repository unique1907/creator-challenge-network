# Creator Challenge Network

**Discover the World's Best Ideas.**

**Turn business problems into winning solutions.**

Creator Challenge Network (CCN) is a programmable Business Challenge platform built on Arc. Brands fund USDC Prize Pools in advance, Creators submit Solution Proposals, Brands evaluate through Blind Review, and Winners receive programmable USDC payouts.

![CCN product overview](./assets/readme/og-cover.png)

## Why CCN

Brands are often limited by internal teams, existing agencies, and narrow sourcing networks. CCN lets Brands publish real business problems to a global network of AI-augmented Creators, then reward outcomes instead of paying only for access to ideas.

Creators get a structured place to discover funded opportunities, submit thoughtful Solution Proposals, track evaluation, and verify reward settlement evidence.

## How It Works

Brand flow:

1. Define a Business Challenge.
2. Configure the Prize Pool and Winner model.
3. Set submission and review deadlines.
4. Fund the Prize Pool.
5. Publish the challenge.
6. Evaluate Solution Proposals through Blind Review.
7. Select Winner(s).
8. Approve payout.
9. Verify the outcome on Arc.

Creator flow:

1. Discover open Business Challenges.
2. Review the problem, expected outcome, and criteria.
3. Submit a Solution Proposal.
4. Track evaluation.
5. Get selected.
6. Receive a USDC Reward.
7. View payout transaction evidence.

## Why Arc + Circle

CCN uses Arc Testnet as the current MVP settlement layer for stablecoin-native Prize Pool and payout evidence.

Arc provides:

- Smart-contract-based settlement.
- Onchain Prize Pool and payout evidence.
- A stablecoin-native environment for USDC reward flows.

USDC is used for:

- Brand-funded Prize Pools.
- Creator Rewards.
- Platform fees.
- Settlement accounting.

Circle Wallets support:

- Brand funding wallet infrastructure.
- Transaction approval.
- Funding flow execution.
- Payout approval and execution where implemented.

## Programmable Money Flow

```text
Brand
  -> Circle Wallet
  -> USDC Prize Pool
  -> Arc Escrow Contract
  -> Published Business Challenge
  -> Creator Solution Proposals
  -> Blind Review
  -> Winner Selection
  -> USDC Payout
  -> Creator Wallet

Platform Fee
  -> CCN Treasury
```

## Core Product Features

- Brand and Creator workspaces.
- Business Challenge creation.
- Configurable Winner model.
- Pre-funded USDC Prize Pools.
- Public LIVE challenge discovery.
- Deadline-aware lifecycle.
- Solution Proposal submission.
- Blind Review.
- Winner finalization.
- Circle Wallet funding and payout flow.
- Arc settlement verification.
- Creator Wallet.
- Reward transaction explorer links.
- Role-aware dashboards.
- Dynamic Brand Next Action.
- Lifecycle handling for no submissions and insufficient submissions.

## Challenge Lifecycle

CCN uses clear lifecycle states across public, Brand, and Creator surfaces:

- Draft
- Open for Solutions
- Evaluation
- Selection
- Settlement
- Completed
- Closed - No Submissions
- Closed - Not Enough Submissions

A Top N challenge requires enough eligible Solution Proposals to fill the configured Winner count under the current MVP settlement contract. If the submission window closes without enough eligible proposals, CCN surfaces a terminal closed state instead of incorrectly advancing the challenge into payout.

## Blind Review

Creator identity is hidden from the Brand during the Blind Review stage according to the implemented review flow. Evaluation focuses on submitted Solution Proposals, not Creator profile identity.

## Architecture

Frontend and application:

- Next.js
- TypeScript
- Tailwind CSS

Data and auth:

- Supabase

Blockchain:

- Arc Testnet
- Solidity
- USDC

Wallet infrastructure:

- Circle Wallets

Deployment:

- Vercel

## Smart Contract / Settlement

CCN uses an Arc Testnet escrow contract to support Brand-funded Prize Pools, Winner configuration, payout settlement, platform fee handling, and post-payout verification/reconciliation.

The MVP keeps settlement state tied to the canonical challenge lifecycle so payout can only become actionable after winner finalization.

## Deployed Contracts

Current canonical Arc Testnet runtime configuration:

- Runtime Escrow Contract: `0x4DCE98F8a35d09F57ECE7A340B8392Ba0Fb7ba3D`
- CCN Treasury: `0x6d2ca88a7bDA59280D9ad0E41aA87C9acF24Aa1A`
- Arc Testnet USDC: `0x3600000000000000000000000000000000000000`

No private keys, wallet PINs, service-role keys, or deployer credentials are stored in this README.

## Live Demo

Production target:

[https://creator-challenge-network.vercel.app](https://creator-challenge-network.vercel.app)

Production deployment is pending final release review.

## Demo Video

Coming soon.

## Presentation

Coming soon.

## Repository

Public repository:

[https://github.com/unique1907/creator-challenge-network](https://github.com/unique1907/creator-challenge-network)

## Running Locally

Install dependencies:

```bash
npm install
```

Create a local environment file from `.env.example`, then provide the required values for:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `CIRCLE_API_KEY`
- `NEXT_PUBLIC_CIRCLE_APP_ID`
- `CCN_LIFECYCLE_PERSISTENCE`
- `ARC_TESTNET_USDC`
- `CCN_ESCROW_CONTRACT_ADDRESS`
- `CCN_PAYOUT_TREASURY_ADDRESS`
- `CCN_PAYOUT_ACCOUNT_ID`
- `CCN_PAYOUT_WALLET_ID`
- `CCN_PAYOUT_WALLET_ADDRESS`

Run the development server:

```bash
npm run dev
```

## Testing

Useful release checks:

```bash
npm run lint
npm run typecheck
npm run build
```

The repository also includes focused verifier scripts for lifecycle classification, Brand and Creator parity, auth and role isolation, challenge creation, funding, winner finalization, payout reconciliation, public projections, and production configuration.

## Demo Environment

The current hackathon MVP runs on Arc Testnet. Balances and rewards use test USDC.

Demo challenges that reference recognizable companies are product demonstrations. Referenced companies are not customers, sponsors, partners, or endorsers of CCN unless explicitly stated otherwise.

## Hackathon

Built for the Programmable Money Hackathon on Arc, Circle's stablecoin-native L1.

Primary submission track: **DeFi**.

CCN fits the DeFi track because it uses programmable USDC Prize Pools, escrow funding, payout settlement, and treasury flows to turn business outcomes into verifiable stablecoin transactions.

## Team

Solo builder project.
