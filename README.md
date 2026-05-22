# FreshTrace

> Immutable supply chain traceability dApp for Vietnam's OCOP-certified agricultural produce.

**Course**: INTE264 — Blockchain Technology Fundamentals
**University**: RMIT University Vietnam
**Group**: 7
**Live deployment**: Polygon Amoy testnet
**Contract address**: [`0x3bc08Bd6e49AC920F0d6CB040dbEa884Ee796816`](https://amoy.polygonscan.com/address/0x3bc08Bd6e49AC920F0d6CB040dbEa884Ee796816)
**Live demo**: [fresh-trace-hmgn.vercel.app](https://fresh-trace-hmgn.vercel.app/)

## Problem Statement

OCOP (One Commune, One Product) certifies high-quality Vietnamese agricultural produce. Yet consumers have no reliable way to verify a product's origin once it leaves the farm — paper certificates can be faked, QR codes link to centralised websites whose data can be edited, and supply chain participants can falsify records without trace.

FreshTrace addresses this with an **append-only, role-based audit log** on the Polygon blockchain. Every checkpoint — from harvest to retail shelf — is signed by the participant's wallet and cannot be altered or deleted, even by the system administrator.

## Features

| Role | Capability |
|---|---|
| **Producer** | Register a new batch → automatic HARVESTED checkpoint + unique QR code |
| **Logistics** | Log main-flow checkpoints (PROCESSED → PACKED → SHIPPED), with forward-only enforcement |
| **Retailer** | Confirm RECEIVED at the end of the supply chain |
| **Auditor** | Flag suspicious batches, then mark flags as **resolved** once concerns are addressed |
| **Any participant** | Append **add-on processes** (Quality Check, Cold Storage, Fumigation) without affecting main-flow ordering |
| **Public consumer** | Scan QR code → verify full supply-chain history without any wallet or account |

### Key Design Decisions

- **Forward-only ordering** with backward-walk algorithm: even when add-on checkpoints are interleaved, the system finds the last main-flow action to prevent retroactive falsification (e.g. SHIPPED then add-on then PROCESSED is blocked)
- **Append-only Checkpoint array**: nothing is ever deleted or overwritten, guaranteed by the absence of any delete or update function in the contract
- **Flag resolution lifecycle**: flags can be raised AND resolved, with `batch.flagged` automatically recomputed
- **Public trace requires zero wallet**: uses a read-only RPC provider via PublicNode
- **Custom errors over revert strings**: gas-efficient and carry typed args (batchId, attempted action, last action) for cleaner front-end handling

### What goes on-chain vs off-chain

To avoid confusion, here is precisely what FreshTrace stores where.

**On-chain (in contract storage):**
- Full batch metadata: productName, origin, harvestDate, quantity, unit, ocop flag, producer address
- Every checkpoint as a full record: actor address, location string, timestamp, action enum, optional ipfsHash, optional addonLabel
- Every audit flag: auditor address, reason string, timestamps, resolution status
- The deterministic batchId derived from the inputs

This makes the chain the authoritative source for the supply-chain narrative
itself. A read of `getHistory(batchId)` returns everything a consumer needs
without touching any other system.

**Off-chain (IPFS via Pinata):**
- Product photo attached at batch registration
- Evidence photo attached at each checkpoint or add-on step

Only the IPFS CID is stored on-chain. The image bytes live on IPFS so we
do not pay storage gas for binary blobs. The CID anchors the image to the
on-chain record cryptographically: a tampered image would not match.

## Tech Stack

| Layer | Technology |
|---|---|
| Smart contract | Solidity 0.8.20, OpenZeppelin `AccessControl` |
| Contract framework | Hardhat 2.x |
| Network (production demo) | Polygon Amoy testnet (chainId `80002`) |
| Network (local dev) | Hardhat Network (chainId `31337`) |
| Frontend | React 18 + Vite + TypeScript |
| Web3 integration | ethers.js v6, custom WalletContext (MetaMask) |
| Off-chain storage | IPFS via Pinata (optional, for evidence photos) |
| Styling | Tailwind CSS |
| QR generation | `qrcode.react` |

## Repository Structure

```
freshtrace/
├── freshtrace-project/freshtrace/          # Hardhat smart contract project
│   ├── contracts/FreshTrace.sol            # Main contract (~470 LOC, fully commented)
│   ├── scripts/
│   │   ├── setup.ts                        # Deploy + grant 4 roles + sync frontend .env
│   │   └── fund.ts                         # Send test ETH on Hardhat local
│   ├── test/FreshTrace.test.ts             # main suite (chai + ethers-v6)
│   ├── test/EdgeCases.test.ts              # boundary + stress edge cases
│   ├── start-dev.ps1                       # One-command local dev setup
│   └── hardhat.config.ts                   # Both Amoy + Hardhat configured
│
└── frontend/                               # React + Vite dApp
    └── src/
        ├── pages/
        │   ├── Dashboard.tsx               # All batches, search + pagination
        │   ├── RegisterBatch.tsx           # Producer-only form, generates QR
        │   ├── LogCheckpoint.tsx           # Tabbed: main-flow vs add-on
        │   ├── AuditBatch.tsx              # Auditor view: flag + resolve
        │   └── PublicTrace.tsx             # No-wallet verification page
        ├── hooks/
        │   ├── useContract.ts              # Signer + read-only Contract factory
        │   ├── useRole.ts                  # 4-role permission check
        │   ├── useBatchHistory.ts          # Tuple parsing + IPFS URL resolution
        │   ├── useCheckpoint.ts            # Pre-validates anomaly client-side
        │   ├── useAddonCheckpoint.ts       # Add-on process submission
        │   ├── useFlagBatch.ts             # Auditor flag tx
        │   ├── useResolveFlag.ts           # Auditor resolve tx
        │   ├── useBatchRegistry.ts         # Register tx + parses event for batchId
        │   ├── usePinata.ts                # IPFS upload via Pinata JWT
        │   └── useDebounce.ts              # Debounced batch-ID lookup
        ├── components/
        │   ├── AuditTimeline.tsx           # Vertical timeline with lightbox
        │   ├── FlaggedBanner.tsx           # Red/green banner + Resolve button
        │   ├── AnomalyBadge.tsx            # Anomaly detection feedback
        │   ├── QRCodeDisplay.tsx           # SVG QR + PNG download
        │   ├── IPFSUpload.tsx              # File picker → Pinata upload
        │   └── WalletConnect.tsx           # MetaMask connect + network switch
        ├── context/WalletContext.tsx       # Direct window.ethereum integration
        └── config/
            ├── chains.ts                   # Network constants, gas overrides
            ├── contract.ts                 # ABI + address from env
            ├── pinata.ts                   # IPFS gateway helper
            └── FreshTrace.json             # ABI (synced from Hardhat artifact)
```
## Prerequisites

- **Node.js** v20 or later
- **MetaMask** browser extension
- **Git** for cloning

For Amoy testnet deployment additionally:
- Polygon Amoy POL from [faucet.polygon.technology](https://faucet.polygon.technology)
- A Pinata account for IPFS image uploads (optional)

## Quick Start — Local Hardhat Network

### 1. Clone and install

```bash
git clone https://github.com/<your-username>/freshtrace.git
cd freshtrace

# Smart contract
cd freshtrace-project/freshtrace
npm install

# Frontend
cd ../../frontend
npm install
```

### 2. Configure environment files

```bash
# Smart contract: defaults are fine, no editing required for local dev.
cd freshtrace-project/freshtrace
cp .env.example .env

# Frontend: defaults work for local dev (uses the Hardhat deterministic
# contract address that start-dev.ps1 always deploys to).
cd ../../frontend
cp .env.example .env
```

On a local Hardhat node, `setup.ts` automatically grants each role to a
different default Hardhat account so you can demo the separation of duties:

| Role | Hardhat account | Address |
|------|----------------|---------|
| DEFAULT_ADMIN | #0 (deployer) | `0xf39F...2266` |
| PRODUCER | #1 | `0x7099...79C8` |
| LOGISTICS | #2 | `0x3C44...93BC` |
| RETAILER | #3 | `0x90F7...b906` |
| AUDITOR | #4 | `0x15d3...6A65` |

Import the matching private keys into MetaMask (see
`freshtrace-project/freshtrace/HARDHAT_ACCOUNTS.md` for the full list) and
switch accounts in MetaMask to demo each role's view.

### 3. Start local blockchain + deploy (Windows PowerShell)

Run this once per session:

```powershell
cd freshtrace-project\freshtrace
.\start-dev.ps1
```

The script:
1. Kills any existing Hardhat node on port 8545
2. Starts a fresh Hardhat node in a new terminal window
3. Deploys `FreshTrace` to the deterministic local address `0x5FbDB2315678afecb367f032d93F642f64180aa3`
4. Grants `PRODUCER_ROLE`, `LOGISTICS_ROLE`, `RETAILER_ROLE`, `AUDITOR_ROLE` to your MetaMask wallet
5. Sends 10 test ETH to your wallet
6. Writes the contract address to `frontend/.env`

### 4. Reset MetaMask after each node restart

After restarting the Hardhat node, the MetaMask transaction nonce cache must be cleared:
**MetaMask → Settings → Advanced → Clear activity tab data**

### 5. Start the frontend

```powershell
cd frontend
npm run dev
```

Open <http://localhost:5173>.

### 6. Add Hardhat Local network to MetaMask

| Field | Value |
|---|---|
| Network Name | Hardhat Local |
| RPC URL | `http://127.0.0.1:8545` |
| Chain ID | `31337` |
| Currency Symbol | ETH |

---

## Quick Start — Polygon Amoy Testnet

The contract is already live at [`0x3bc08Bd6e49AC920F0d6CB040dbEa884Ee796816`](https://amoy.polygonscan.com/address/0x3bc08Bd6e49AC920F0d6CB040dbEa884Ee796816).

To use this deployment:

1. Set `frontend/.env`:
   ```
   VITE_CHAIN_ID=80002
   VITE_POLYGON_AMOY_RPC_URL=https://polygon-amoy-bor-rpc.publicnode.com
   VITE_CONTRACT_ADDRESS=0x3bc08Bd6e49AC920F0d6CB040dbEa884Ee796816
   ```
2. Add Polygon Amoy network to MetaMask
3. Request POL from the faucet (you only need ~0.05 POL for testing)
4. Note: only the deployer (Group 7's wallet) holds `DEFAULT_ADMIN_ROLE`. To get a participant role on this deployment, contact us. For your own deployment, see below.

### Deploying your own copy

1. Add to `freshtrace-project/freshtrace/.env`:
   ```
   PRIVATE_KEY=0xYOUR_PRIVATE_KEY
   POLYGON_AMOY_RPC_URL=https://polygon-amoy-bor-rpc.publicnode.com

   # Single-wallet mode (one wallet receives all four roles)
   WALLET_ADDRESS=0xYOUR_METAMASK

   # OR per-role mode (one wallet per role) for a realistic demo
   # WALLET_PRODUCER=0x...
   # WALLET_LOGISTICS=0x...
   # WALLET_RETAILER=0x...
   # WALLET_AUDITOR=0x...
   ```
2. Deploy:
   ```bash
   cd freshtrace-project/freshtrace
   npx hardhat run scripts/setup.ts --network amoy
   ```

The script auto-updates `frontend/.env` with the new contract address.
If any per-role var is set, those win; otherwise WALLET_ADDRESS gets
all four roles; otherwise the deployer does.

---

## Tests

```bash
# Smart contract (Hardhat + chai)
cd freshtrace-project/freshtrace
npx hardhat test

# Frontend (Vitest + React Testing Library)
cd ../../frontend
npm test
```

**114 contract tests + 57 frontend tests** (171 total) run automatically via GitHub Actions CI on every push.

Contract tests cover (76 in the main suite, 32 in the edge case suite):

- Deployment and role assignment
- `registerBatch` happy path plus revert paths
- `logCheckpoint` ordering, anomaly detection, RBAC
- `flagBatch` lifecycle, including accumulating multiple flags
- `logAddon` for all four roles and ordering edge cases
- `resolveFlag` partial and full resolution flows, RBAC
- `getHistory`, `getBatchIds`, `getBatchCount` view functions
- Input validation: empty fields, oversized strings, date sanity, unit enum
- Boundary values: quantity at uint256 max, 300-byte name limits
- UTF-8: Vietnamese diacritics, emoji, Chinese characters round-trip
- Add-on placement: at chain start, at chain end, multiple consecutive
- Duplicate detection and the abi.encode collision fix

Frontend tests cover (57 total): debounced batch-ID lookup, bytes32 hex
validation, recent-batches localStorage with edge cases (corrupted JSON,
quota exceeded, case-insensitive dedup), i18n provider (default locale,
fallback, persistence), the LanguageToggle and ErrorMessage components,
and the friendlyError / classifyError helpers across 11 error kinds.

## Gas + Throughput Benchmark

Live measurements on Polygon Amoy with a fresh deploy (see
`freshtrace-project/freshtrace/BENCHMARK.md` for the full report and
on-chain transaction links):

| Function | Gas | Cost @ 30 gwei | Cost USD @ $0.25 POL |
|---|---:|---:|---:|
| registerBatch | 335,746 | 0.0101 POL | $0.0025 |
| logCheckpoint | 171,272 | 0.0051 POL | $0.0013 |
| logAddon | 160,426 | 0.0048 POL | $0.0012 |
| flagBatch | 149,351 | 0.0045 POL | $0.0011 |
| resolveFlag | 94,826 | 0.0028 POL | $0.0007 |

A full batch lifecycle (register + four main-flow checkpoints + one add-on
+ one flag and resolve) totals 1.43M gas, around **$0.011 per batch**.

Theoretical throughput ceiling at average 178k gas per call against a
30M gas block limit and 2s block time is **about 84 FreshTrace tx per
second**. For Vietnam's roughly 10,000 OCOP-certified products at 100
batches per producer per month, the entire national rollout would cost
on the order of $1,000 per month in gas, while replacing paper
certificates entirely.

Reproduce: `npx hardhat run scripts/benchmark.ts --network amoy`

---

## Environment Variables

### `freshtrace-project/freshtrace/.env`

| Variable | Description |
|---|---|
| `PRIVATE_KEY` | Wallet private key for Amoy deployment (leave blank for local-only) |
| `POLYGON_AMOY_RPC_URL` | Amoy RPC endpoint (default `https://polygon-amoy-bor-rpc.publicnode.com`) |
| `HARDHAT_RPC_URL` | Local node URL (default `http://127.0.0.1:8545`) |
| `HARDHAT_PRIVATE_KEY` | Hardhat account #0 private key (public test key, safe to share) |

### `frontend/.env`

| Variable | Description |
|---|---|
| `VITE_CHAIN_ID` | `31337` for Hardhat local, `80002` for Polygon Amoy |
| `VITE_POLYGON_AMOY_RPC_URL` | RPC endpoint for public reads (no wallet needed) |
| `VITE_CONTRACT_ADDRESS` | Deployed contract address (auto-updated by `setup.ts`) |
| `VITE_PINATA_JWT` | Pinata API JWT for IPFS uploads (optional) |
| `VITE_PINATA_GATEWAY` | Pinata gateway URL (default `https://gateway.pinata.cloud`) |
| `VITE_WALLETCONNECT_PROJECT_ID` | Optional WalletConnect project ID for mobile wallet support |

---

## LLM Usage Disclosure

Per RMIT academic integrity policy, this project's development made use of:

- **Anthropic Claude** (Sonnet 4.6 + Opus 4.7 via Claude Code CLI): used for code architecture suggestions, smart contract design review, debugging RPC and ABI-decoding issues, and writing comprehensive code comments and tests.

All design decisions, problem-modelling, and final code review were performed by Group 7 members. The LLM was treated as a collaborative tool, not an authority.

---

## License

MIT — see `LICENSE` if present, otherwise this notice serves as the licence grant.
