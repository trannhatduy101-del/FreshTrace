# Hardhat default accounts

Hardhat's local node always boots with the same 20 deterministic accounts.
We use the first five for the demo, one role per account so the presenter
can switch MetaMask between them and naturally show each actor's view.

The private keys below are public, well-known Hardhat test keys. They
work only on a local Hardhat node and have no value on any real network.
Safe to import into MetaMask for demo purposes; never use them on a
mainnet or with real funds.

## Role mapping (matches scripts/setup.ts)

| Account | Role on the contract | Address | Private key |
|---------|---------------------|---------|-------------|
| #0 | DEFAULT_ADMIN_ROLE (deployer) | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` |
| #1 | PRODUCER_ROLE | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d` |
| #2 | LOGISTICS_ROLE | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | `0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a` |
| #3 | RETAILER_ROLE | `0x90F79bf6EB2c4f870365E785982E1f101E93b906` | `0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6` |
| #4 | AUDITOR_ROLE | `0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65` | `0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a` |

## How to import into MetaMask

1. Open MetaMask -> click the avatar circle (top right)
2. Click "Add account or hardware wallet" -> "Import account"
3. Paste the private key from the table above
4. Repeat for each role you want to demo
5. Rename each account in MetaMask for clarity, e.g. "Producer Demo",
   "Logistics Demo", "Retailer Demo", "Auditor Demo"

## How the demo flow looks

1. Connect Account #1 (Producer Demo)
   - Header shows: `[Producer]` badge
   - Can use /register, blocked on /audit
2. Switch to Account #2 (Logistics Demo) in MetaMask
   - Header refreshes to: `[Logistics]`
   - Can use /checkpoint, blocked on /register
3. ... and so on for Retailer and Auditor

This shows the "separation of duties" property of the contract without
needing five separate machines or browser profiles.
