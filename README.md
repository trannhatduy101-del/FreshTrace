# FreshTrace

A small dApp that puts the supply chain trail of Vietnamese OCOP-certified
produce on the Polygon blockchain. Every step from farm to retail shelf is
signed by a wallet and cannot be edited after the fact, so the consumer
who scans the QR sees the real history, not whatever a website happens to
say today.

Live demo: https://fresh-trace-hmgn.vercel.app
Contract on Polygon Amoy: 0x3bc08Bd6e49AC920F0d6CB040dbEa884Ee796816
([Polygonscan](https://amoy.polygonscan.com/address/0x3bc08Bd6e49AC920F0d6CB040dbEa884Ee796816))

## Why

OCOP (One Commune, One Product) is Vietnam's quality certification for
agricultural goods, but once a batch leaves the farm there is no
trustworthy way to verify its origin. Paper certificates can be forged,
QR codes on packaging usually link to a regular website whose database
the seller controls, and intermediate steps in the chain go undocumented.

The chain is the audit log. Producers register a batch and get a unique
on-chain id. Logistics and retailer accounts append checkpoints as the
goods move forward, with a strict forward-only rule so you cannot insert
a PROCESSED step once SHIPPED is already recorded. Auditors can raise
flags and later resolve them. Anyone can read the full history through
the public trace page with no wallet at all.

## What it does

A producer registers a new batch and gets a QR code printed on the
packaging. The HARVESTED step is created in the same transaction.

Logistics scans the QR, picks an action (PROCESSED, PACKED, SHIPPED) and
logs the checkpoint. Retailer does the same for the final RECEIVED step.
Any of the four roles can also add a custom step (Quality Check, Cold
Storage, Customs, Fumigation) without breaking the main flow order.

An auditor can flag a batch with a reason. The flag stays open until an
auditor resolves it. A flagged batch is still allowed to move through
the chain, so goods in transit are not stranded; the warning just shows
up loud on the trace page.

A consumer opens the trace URL (or scans the QR), sees the product, the
producer's wallet, every checkpoint and add-on in order, every flag and
its resolution status, and any evidence photos pinned to IPFS.

## Stack

Solidity 0.8.20 with OpenZeppelin AccessControl for the four roles
(Producer, Logistics, Retailer, Auditor) plus the deployer's admin role.
Hardhat for compile and test, deployed to Polygon Amoy testnet.

Frontend is React 18 with Vite and TypeScript. Wallet plumbing via
ethers v6 and @web3modal/ethers for MetaMask plus WalletConnect QR on
mobile. Tailwind for styling. Pinata for the optional IPFS uploads.

CI is a single GitHub Actions workflow that compiles the contract, runs
both test suites, type-checks the frontend, and runs the production
build on every push.

## Quick start (local Hardhat)

You need Node v20 or later, Git, and the MetaMask browser extension.

Clone and install:

```bash
git clone https://github.com/trannhatduy101-del/FreshTrace.git
cd FreshTrace
cd freshtrace-project/freshtrace && npm install
cd ../../frontend && npm install
```

Copy the example env files. Defaults are fine for local development.

```bash
cd ../freshtrace-project/freshtrace
cp .env.example .env
cd ../../frontend
cp .env.example .env
```

Start a fresh Hardhat node, deploy the contract, grant the four roles
to the five Hardhat default accounts:

```powershell
cd freshtrace-project\freshtrace
.\start-dev.ps1
```

`start-dev.ps1` kills any old node on port 8545, opens a new one in a
separate terminal, runs `setup.ts` and `fund.ts`, and writes the
contract address into `frontend/.env`. The contract always lands at
`0x5FbDB2315678afecb367f032d93F642f64180aa3` because Hardhat is
deterministic at nonce 0.

Then start the frontend:

```bash
cd ../../frontend
npm run dev
```

Open http://localhost:5173 and connect MetaMask to the Hardhat Local
network (RPC `http://127.0.0.1:8545`, chainId `31337`, currency `ETH`).
After every Hardhat restart you need to clear MetaMask's nonce cache:
Settings, Advanced, Clear activity tab data.

The five Hardhat default accounts each end up with one role (see
`HARDHAT_ACCOUNTS.md` for the keys). Account 0 also keeps all four
participant roles on top of admin, so you can run a solo demo from a
single MetaMask account or switch between the five to show the
separation of duties.

## Quick start (against the live Amoy contract)

If you just want to see the dApp talking to the existing deployment,
skip the local node. Set `frontend/.env` to:

```
VITE_CHAIN_ID=80002
VITE_POLYGON_AMOY_RPC_URL=https://polygon-amoy-bor-rpc.publicnode.com
VITE_CONTRACT_ADDRESS=0x3bc08Bd6e49AC920F0d6CB040dbEa884Ee796816
```

Run the frontend (`npm run dev`), add the Polygon Amoy network to
MetaMask, and request a bit of POL from
https://faucet.polygon.technology for gas.

Read access works out of the box. To register batches or log
checkpoints on this deployment you need a role granted by the admin
wallet, so ping us with your address or deploy your own copy.

## Deploying your own copy

In `freshtrace-project/freshtrace/.env`:

```
PRIVATE_KEY=0xYOUR_DEPLOYER_KEY
POLYGON_AMOY_RPC_URL=https://polygon-amoy-bor-rpc.publicnode.com

# Single-wallet mode: one wallet receives all four participant roles.
WALLET_ADDRESS=0xYOUR_METAMASK

# Or per-role mode: one wallet per role for a realistic demo.
# WALLET_PRODUCER=0x...
# WALLET_LOGISTICS=0x...
# WALLET_RETAILER=0x...
# WALLET_AUDITOR=0x...
```

Then `npx hardhat run scripts/setup.ts --network amoy`. The script
updates `frontend/.env` with the new contract address. Per-role vars
override the single fallback, and the deployer always keeps all roles
for solo demos.

## On-chain vs off-chain

Worth being precise about this because "blockchain projects" often
hand-wave it. The contract stores full structured metadata, not just
a hash:

- `Batch`: productName, origin, harvestDate, quantity, unit, ocop flag,
  producer address, ipfsHash (for the product photo only).
- `Checkpoint[]`: actor, location, timestamp, action enum, optional
  ipfsHash (for evidence photos), optional addonLabel.
- `AuditFlag[]`: auditor, reason text, timestamps, resolution state.

So `getHistory(batchId)` is a single call that returns everything a
consumer needs without touching any external system.

Off-chain we only put image bytes on IPFS via Pinata, with the CID
stored on-chain. The CID is the cryptographic anchor: any byte change
in the image breaks the hash, so we get tamper-evident photos without
paying gas for binary blobs.

## Tests

```bash
# Contract: 114 tests, Hardhat + chai
cd freshtrace-project/freshtrace
npx hardhat test

# Frontend: 57 tests, Vitest + React Testing Library
cd ../../frontend
npm test
```

Contract suite covers role assignment, the full register and checkpoint
flow, anomaly detection in both directions, add-on placement at start
and end of the chain, flag and resolve lifecycles, view functions,
input validation (empty fields, oversized strings, date sanity, unit
enum), boundary values (uint256 max quantity, 300-byte name caps),
UTF-8 round-trips for Vietnamese diacritics and Chinese characters,
duplicate detection, and the abi.encode collision fix.

Frontend suite covers the debounced batch-id lookup, bytes32 format
validation, the recent-batches localStorage logic with corrupted JSON
and quota-exceeded edge cases, the i18n context (default locale,
fallback, persistence), and the friendlyError parser across 11 error
kinds.

CI runs both suites plus a production build on every push.

## Gas and throughput on Amoy

Real measurements from `scripts/benchmark.ts` against a fresh deploy,
full details in `BENCHMARK.md`. At 30 gwei tip and a POL price of
$0.25:

| Function       | Gas      | POL     | USD     |
|----------------|---------:|--------:|--------:|
| registerBatch  | 335,746  | 0.0101  | $0.0025 |
| logCheckpoint  | 171,272  | 0.0051  | $0.0013 |
| logAddon       | 160,426  | 0.0048  | $0.0012 |
| flagBatch      | 149,351  | 0.0045  | $0.0011 |
| resolveFlag    |  94,826  | 0.0028  | $0.0007 |

A complete batch lifecycle (register, four main-flow checkpoints, one
add-on, one flag, one resolve) costs about $0.011 per batch. Against
Amoy's 30M block gas limit and 2s block time the theoretical ceiling
is around 84 of our transactions per second.

At Vietnam's roughly 10,000 OCOP-certified products and 100 batches
per producer per month, a national rollout sits in the low thousands
of dollars per month in gas, which is roughly one mid-tier SaaS bill
and replaces paper certification entirely.

Reproduce with `npx hardhat run scripts/benchmark.ts --network amoy`.

## Environment variables

`freshtrace-project/freshtrace/.env`:

- `PRIVATE_KEY`: deployer key for Amoy. Leave blank if you only run
  tests or local Hardhat.
- `POLYGON_AMOY_RPC_URL`: Amoy RPC. Default works.
- `WALLET_ADDRESS`: single-wallet mode target on Amoy.
- `WALLET_PRODUCER`, `WALLET_LOGISTICS`, `WALLET_RETAILER`,
  `WALLET_AUDITOR`: per-role mode targets. Any one of them switches
  the script into per-role mode.
- `HARDHAT_PRIVATE_KEY`: public Hardhat test key. Safe to commit,
  only works on the local node.
- `CONTRACT_ADDRESS`: used by `grantRoles.ts` for post-deploy ops.

`frontend/.env`:

- `VITE_CHAIN_ID`: `31337` for Hardhat, `80002` for Amoy.
- `VITE_POLYGON_AMOY_RPC_URL`: RPC for public reads, no wallet needed.
- `VITE_CONTRACT_ADDRESS`: deployed contract. `setup.ts` updates this
  for you on deploy.
- `VITE_PINATA_JWT`, `VITE_PINATA_GATEWAY`: optional, for image upload.
- `VITE_WALLETCONNECT_PROJECT_ID`: optional, for mobile QR wallet
  connection via Reown.

## LLM use

Per RMIT policy, this writeup discloses where AI tooling helped. We
used Anthropic Claude (Sonnet and Opus through the Claude Code CLI)
for things like brainstorming the multi-account demo design, debugging
the rate-limit and ABI-decoding issues, and tightening up code
comments and test names. Every design call, every contract function,
and the final review were on us.
