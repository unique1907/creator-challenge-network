# CCN Escrow Contracts

Foundry workspace for the Sprint 4B `CCNEscrow` implementation.

## Architecture

- Single non-upgradeable `CCNEscrow` contract.
- All challenges are keyed by `bytes32 challengeId`.
- USDC and treasury addresses are immutable constructor inputs.
- Supported payouts are Top 1 and Top 3 only.
- The resolver releases payouts or authorizes refunds after CCN off-chain review.
- The pauser can only pause and unpause money-moving functions.
- There is no factory, proxy, arbitrary admin withdrawal, or token sweep in this MVP.

Unexpected excess USDC sent directly to the contract is intentionally not recoverable by an
admin sweep function. This avoids creating an emergency-withdraw surface that could touch active
challenge liabilities.

The resolver must verify off-chain submission and dispute policy before calling
`cancelAndRefund(bytes32)`. The contract only controls escrowed money, not submission state.

## Local Commands

```bash
forge fmt --check
forge build
forge test -vvv
forge test --match-path test/CCNEscrowInvariant.t.sol -vvv
```

## Deployment Script Inputs

The deploy script is present for a later task only. Do not broadcast in Sprint 4B.
It reverts unless the active chain ID is Arc Testnet `5042002`.

```bash
ARC_TESTNET_USDC=0x3600000000000000000000000000000000000000
CCN_TREASURY_ADDRESS=
CCN_ADMIN_ADDRESS=
CCN_RESOLVER_ADDRESS=
CCN_PAUSER_ADDRESS=
DEPLOYER_PRIVATE_KEY=
```

Never commit a real private key or local environment file.
