# FreshTrace

> Immutable supply chain traceability dApp for Vietnam's OCOP-certified agricultural produce.

**Course**: INTE264 — Blockchain Technology Fundamentals
**University**: RMIT University Vietnam
**Group**: 7
**Live deployment**: Polygon Amoy testnet
**Contract address**: [`0x2Ba4bE636888767B663e18d2a66D0dCc21E82ae2`](https://amoy.polygonscan.com/address/0x2Ba4bE636888767B663e18d2a66D0dCc21E82ae2)
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

- **Forward-only ordering** with backward-walk algorithm: even when add-on checkpoints are interleaved, the system finds the last main-flow action to prevent retroactive falsification (e.g. SHIPPED → add-on → PROCESSED is blocked)
- **Append-only Checkpoint array**: nothing is ever deleted or overwritten — guaranteed by absence of `delete` operations in the contract
- **Flag resolution lifecycle**: flags can be raised AND resolved, with `batch.flagged` automatically recomputed
- **Public trace requires zero wallet**: uses a read-only RPC provider via PublicNode
- **Custom errors over revert strings**: gas-efficient and carry typed args (batchId, attempted action, last action) for cleaner front-end handling

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
│   ├── test/FreshTrace.test.ts             # 66 automated tests (chai + ethers-v6)
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
# Smart contract
cd freshtrace-project/freshtrace
cp .env.example .env
# Open .env and set WALLET_ADDRESS to your MetaMask address (optional but recommended)

# Frontend — defaults work for local dev (uses Hardhat deterministic address)
cd ../../frontend
cp .env.example .env
```

> **First-time users without a MetaMask wallet?** You can skip `WALLET_ADDRESS`
> and instead import the Hardhat #0 private key (in `.env.example`) into
> MetaMask. That account already has 10000 test ETH and `setup.ts` will grant
> it all 4 roles by default.

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

The contract is already live at [`0xE15188bF47e56e0Dd118f51c85Ff9D23D4271268`](https://amoy.polygonscan.com/address/0xE15188bF47e56e0Dd118f51c85Ff9D23D4271268).

To use this deployment:

1. Set `frontend/.env`:
   ```
   VITE_CHAIN_ID=80002
   VITE_POLYGON_AMOY_RPC_URL=https://polygon-amoy-bor-rpc.publicnode.com
   VITE_CONTRACT_ADDRESS=0xE15188bF47e56e0Dd118f51c85Ff9D23D4271268
   ```
2. Add Polygon Amoy network to MetaMask
3. Request POL from the faucet (you only need ~0.05 POL for testing)
4. Note: only the deployer (Group 7's wallet) holds `DEFAULT_ADMIN_ROLE`. To get a participant role on this deployment, contact us. For your own deployment, see below.

### Deploying your own copy

1. Add to `freshtrace-project/freshtrace/.env`:
   ```
   PRIVATE_KEY=0xYOUR_PRIVATE_KEY
   POLYGON_AMOY_RPC_URL=https://polygon-amoy-bor-rpc.publicnode.com
   ```
2. Deploy:
   ```bash
   cd freshtrace-project/freshtrace
   npx hardhat run scripts/setup.ts --network amoy
   ```

The script auto-updates `frontend/.env` with the new contract address.

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

**76 contract tests + 18 frontend tests** — all run automatically via GitHub Actions CI on every push.

Contract tests cover:

- Deployment & role assignment (2)
- `registerBatch` happy path + revert paths (6)
- `logCheckpoint` ordering, anomaly detection, RBAC (10)
- `flagBatch` lifecycle (4 + 4 edge cases)
- `logAddon` for all 4 roles, ordering edge cases (11)
- `resolveFlag` partial/full resolution, RBAC (8)
- `getHistory`, `getBatchIds`, `getBatchCount` (8)
- Edge cases: missing batch, large quantities, forward-skip, timestamp drift (12)
- Anomaly detection: backward moves, duplicate stages (3)
- Add-on flow integrity: backward-walk correctness (1)
- Input validation: empty fields, oversized strings, date sanity, unit enum (10)

Frontend tests cover: debounced batch-ID lookup, `bytes32` hex validation, recent-history localStorage logic.

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
