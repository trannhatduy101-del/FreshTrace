# FreshTrace

Immutable audit log dApp for Vietnam's OCOP-certified agricultural produce supply chain, built on Polygon Amoy testnet.

**Course**: INTE264 Blockchain Technology Fundamentals — RMIT  
**Group**: 7  
**Instructor**: Dr. Jeff Nijsse

## Architecture

- **Smart Contract** (Solidity 0.8.20) — on-chain logic + data layer
- **IPFS** (Pinata) — off-chain storage for images and certificates
- **Polygon Amoy** (L2) — inherits Ethereum L1 security via native checkpointing
- **React Frontend** — separate repository (consumes ABI + deployments.json)

## Setup

### Prerequisites

- Node.js v20+
- Python 3.11+
- MetaMask with Polygon Amoy testnet configured

### Install

```bash
# Install Node dependencies
npm install

# Install Python dependencies
pip install web3 python-dotenv tabulate
```

### Configure

```bash
cp .env.example .env
# Fill in your private key, RPC URL, and test wallet addresses
```

## Usage

### Compile

```bash
npx hardhat compile
```

### Test

```bash
npx hardhat test
```

### Deploy

```bash
# Deploy to local Hardhat node
npx hardhat run scripts/deploy.ts

# Deploy to Polygon Amoy
npx hardhat run scripts/deploy.ts --network amoy

# Deploy via Python (alternative)
cd python && python deploy.py
```

### Simulation

```bash
# Run after deploying — set CONTRACT_ADDRESS in .env first
cd python && python simulate.py
```

## Project Structure

```
freshtrace/
├── contracts/FreshTrace.sol        # Core smart contract
├── test/FreshTrace.test.ts         # Full test suite
├── scripts/deploy.ts               # Hardhat deployment
├── python/
│   ├── deploy.py                   # Web3.py deployment
│   ├── simulate.py                 # Scaling simulation
│   └── utils.py                    # Shared utilities
├── shared/types.ts                 # TypeScript types for frontend
├── hardhat.config.ts               # Hardhat configuration
└── deployments.json                # Auto-generated on deploy
```

## Frontend Integration

The frontend team needs:

1. **ABI**: `artifacts/contracts/FreshTrace.sol/FreshTrace.json` (the `abi` field)
2. **Contract address**: `deployments.json` (the `address` field)
3. **Types**: `shared/types.ts`

## License

MIT
