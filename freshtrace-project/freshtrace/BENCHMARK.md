# Gas + throughput benchmark on Polygon Amoy

Run live against a freshly deployed FreshTrace contract on Amoy testnet.
Numbers reflect actual on-chain execution, not estimates.

## Setup

- Network: Polygon Amoy (chainId 80002)
- Benchmark contract: `0xE3585A482711C2D3E881D2337A94eB97798813bE`
- Deployer: `0x7ceCf067854Ca5DA065DcFDF57dDA4056B2c5984`
- Gas price applied: 30 gwei priority + 60 gwei max (the TX_OVERRIDES used by the dApp)
- POL price snapshot for USD column: $0.25
- Reproduce: `npx hardhat run scripts/benchmark.ts --network amoy`

## Per-function cost

| Function | Gas used | Cost (POL) | Cost (USD @ $0.25) | Latency (ms) |
|---|---:|---:|---:|---:|
| registerBatch | 335,746 | 0.01007 | $0.00252 | 1,879 |
| logCheckpoint (PROCESSED) | 171,272 | 0.00514 | $0.00129 | 3,170 |
| logCheckpoint (PACKED) | 171,272 | 0.00514 | $0.00129 | 2,446 |
| logCheckpoint (SHIPPED) | 171,272 | 0.00514 | $0.00129 | 1,699 |
| logCheckpoint (RECEIVED) | 171,272 | 0.00514 | $0.00129 | 1,276 |
| logAddon | 160,426 | 0.00481 | $0.00120 | 1,702 |
| flagBatch | 149,351 | 0.00448 | $0.00112 | 1,315 |
| resolveFlag | 94,826 | 0.00284 | $0.00071 | 1,272 |

Latency includes mempool admission, block inclusion, and one block of
confirmation (`tx.wait(1)`). Polygon Amoy block time is roughly 2 seconds.

## Full lifecycle for one batch

A batch from registration to RECEIVED with one add-on, one flag, and one
flag resolution touches eight transactions:

- 1 registerBatch
- 4 logCheckpoint (one per main-flow stage)
- 1 logAddon
- 1 flagBatch
- 1 resolveFlag

| Metric | Value |
|---|---:|
| Total gas | 1,425,437 |
| Total cost | 0.04276 POL (~$0.01069) |
| Average per call | 178,179 gas |

## Throughput ceiling

With Polygon Amoy's 30M block gas limit and ~2s block time:

- `block_gas_limit / avg_gas_per_call / block_time`
- `30,000,000 / 178,179 / 2s` = approximately **84 FreshTrace tx per second**

This is the theoretical upper bound if the entire block were filled with
FreshTrace traffic. In practice the chain is shared with many other
applications, so realistic per-application throughput is lower, but the
ceiling shows that even a national-scale OCOP rollout could comfortably
fit within Amoy's capacity.

## Cost projection for a real OCOP rollout

Vietnam's OCOP program currently certifies on the order of 10,000+
products from over 60 provinces and cities. Assume a moderately active
mid-sized cooperative:

- 100 batches per month per producer
- 8 transactions per batch (full lifecycle as above)
- 800 tx per producer per month
- At ~$0.01 per lifecycle, **about $1.07 per month per producer**

For a province-scale pilot of 100 producers: ~$107 per month.

For a national rollout of 1,000 producers: ~$1,070 per month, comparable
to the cost of a single mid-tier SaaS subscription, while replacing
paper certificates entirely.

## Notes on cost stability

Polygon Amoy gas fees are highly variable on testnet. Real Polygon
mainnet (PoS) fees in 2025 have averaged below 30 gwei in normal
conditions. The TX_OVERRIDES constant in `frontend/src/config/chains.ts`
sets a 30 gwei priority and 60 gwei max which keeps transactions
reliable on the rate-limited Amoy RPC, but on mainnet a more
conservative tip would lower these numbers by 30 to 50 percent.
