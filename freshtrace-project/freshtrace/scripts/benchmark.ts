import { ethers, network } from "hardhat";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
dotenv.config();

// Live measurement of gas + latency for every write function on FreshTrace.
// Run against Amoy with: npx hardhat run scripts/benchmark.ts --network amoy
//
// Output:
//   - Markdown table printed to stdout
//   - JSON file at benchmark-results.json for the report
//
// Reads CONTRACT_ADDRESS from .env, falls back to a fresh deploy if unset.

interface Row {
  step: string;
  txHash: string;
  gasUsed: bigint;
  gasPriceWei: bigint;
  costPol: string;   // ETH-formatted POL cost
  costUsd: string;   // estimated USD cost at the price below
  blockNumber: number;
  durationMs: number;
}

// POL price snapshot. Update to current price before re-running if needed.
// Conservative anchor; the report should reference this constant explicitly.
const POL_USD_PRICE = 0.25;

async function measure(
  step: string,
  call: () => Promise<any>
): Promise<Row> {
  const start = Date.now();
  const tx = await call();
  const receipt = await tx.wait();
  const durationMs = Date.now() - start;

  const gasUsed: bigint = receipt.gasUsed;
  const gasPriceWei: bigint = receipt.gasPrice ?? tx.gasPrice ?? 0n;
  const costWei = gasUsed * gasPriceWei;
  const costPol = ethers.formatEther(costWei);
  const costUsd = (Number(costPol) * POL_USD_PRICE).toFixed(6);

  console.log(`  ${step}: gas=${gasUsed} cost=${costPol} POL (~$${costUsd}) in ${durationMs}ms`);

  return {
    step,
    txHash: receipt.hash,
    gasUsed,
    gasPriceWei,
    costPol,
    costUsd,
    blockNumber: receipt.blockNumber,
    durationMs,
  };
}

async function main() {
  console.log("Network:", network.name);
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // Use existing contract if CONTRACT_ADDRESS is set, otherwise deploy fresh.
  // For a clean benchmark we recommend a fresh deploy so block numbers and
  // batch counts start from zero.
  let contractAddress = process.env.CONTRACT_ADDRESS;
  if (!contractAddress) {
    console.log("CONTRACT_ADDRESS not set, deploying a fresh contract for the benchmark...");
    const Factory = await ethers.getContractFactory("FreshTrace");
    const fresh = await Factory.deploy();
    await fresh.waitForDeployment();
    contractAddress = await fresh.getAddress();
    console.log("Deployed at:", contractAddress);
    // Grant ourselves all four roles so we can drive every write path.
    for (const role of ["PRODUCER_ROLE", "LOGISTICS_ROLE", "RETAILER_ROLE", "AUDITOR_ROLE"]) {
      const hash = await (fresh as any)[role]();
      const tx = await fresh.grantRole(hash, deployer.address);
      await tx.wait();
    }
    console.log("Self-granted all four roles.");
  }

  const contract = await ethers.getContractAt("FreshTrace", contractAddress, deployer);
  console.log("Using contract:", contractAddress);
  console.log("---");

  const rows: Row[] = [];

  // Polygon Amoy needs a tip well above its 25 gwei floor.
  const overrides = network.name === "amoy"
    ? { maxPriorityFeePerGas: 30_000_000_000n, maxFeePerGas: 60_000_000_000n }
    : {};

  // 1. registerBatch
  const harvestDate = Math.floor(Date.now() / 1000) - 86400;
  const registerRow = await measure("registerBatch", () =>
    contract.registerBatch("Benchmark Mango", "Dong Thap", harvestDate, 5000, 0, true, "", overrides)
  );
  rows.push(registerRow);

  // Need the batchId from the event for subsequent calls.
  const registerReceipt = await ethers.provider.getTransactionReceipt(registerRow.txHash);
  let batchId = "";
  for (const log of registerReceipt!.logs) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed?.name === "BatchRegistered") {
        batchId = parsed.args.batchId as string;
        break;
      }
    } catch {}
  }
  if (!batchId) throw new Error("BatchRegistered event not found");
  console.log("  batchId:", batchId);

  // 2. logCheckpoint, four times to cover PROCESSED, PACKED, SHIPPED, RECEIVED
  for (const [name, action] of [
    ["logCheckpoint(PROCESSED)", 1],
    ["logCheckpoint(PACKED)",    2],
    ["logCheckpoint(SHIPPED)",   3],
    ["logCheckpoint(RECEIVED)",  4],
  ] as const) {
    rows.push(await measure(name, () =>
      contract.logCheckpoint(batchId, action, `Step ${action}`, "", overrides)
    ));
  }

  // 3. logAddon
  rows.push(await measure("logAddon", () =>
    contract.logAddon(batchId, "Quality Check", "Lab HCM", "", overrides)
  ));

  // 4. flagBatch
  rows.push(await measure("flagBatch", () =>
    contract.flagBatch(batchId, "Temperature excursion benchmark", overrides)
  ));

  // 5. resolveFlag
  rows.push(await measure("resolveFlag", () =>
    contract.resolveFlag(batchId, 0, overrides)
  ));

  // Done. Print markdown summary.
  console.log("---\nResults (POL price assumed: $" + POL_USD_PRICE + "):\n");
  console.log("| Function | Gas used | Cost (POL) | Cost (USD) | Latency (ms) | Block | Tx |");
  console.log("|---|---:|---:|---:|---:|---:|---|");
  let totalGas = 0n;
  for (const r of rows) {
    totalGas += r.gasUsed;
    console.log(`| ${r.step} | ${r.gasUsed.toLocaleString()} | ${r.costPol} | $${r.costUsd} | ${r.durationMs} | ${r.blockNumber} | [${r.txHash.slice(0, 12)}...](https://amoy.polygonscan.com/tx/${r.txHash}) |`);
  }
  console.log(`\nTotal gas across one full batch lifecycle: ${totalGas.toLocaleString()}`);

  // Throughput estimate: Polygon Amoy block time is ~2s, block gas limit
  // ~30M. tps = blockGasLimit / avgTxGas / 2s.
  const avgGas = totalGas / BigInt(rows.length);
  const blockGasLimit = 30_000_000n;
  const tpsCeiling = Number(blockGasLimit / avgGas) / 2;
  console.log(`Average per-call gas: ${avgGas.toLocaleString()}`);
  console.log(`Theoretical TPS ceiling at avg gas: ~${tpsCeiling.toFixed(0)} tx/s`);

  // Persist JSON for the report.
  const out = {
    network: network.name,
    contract: contractAddress,
    polUsdPrice: POL_USD_PRICE,
    timestamp: new Date().toISOString(),
    rows: rows.map((r) => ({
      ...r,
      gasUsed: r.gasUsed.toString(),
      gasPriceWei: r.gasPriceWei.toString(),
    })),
    totals: {
      gas: totalGas.toString(),
      avgGas: avgGas.toString(),
      tpsCeiling: tpsCeiling,
    },
  };
  const outPath = path.resolve(process.cwd(), "benchmark-results.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log("\nWrote:", outPath);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
