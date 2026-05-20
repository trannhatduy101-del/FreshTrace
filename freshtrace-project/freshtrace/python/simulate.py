"""
Scaling simulation for FreshTrace — generates data for report Section 7.

Registers test batches, runs full checkpoint flows, flags samples,
then computes gas costs and Vietnam-scale throughput projections.
"""

import json
import time
import sys
from pathlib import Path
from web3 import Web3
from tabulate import tabulate
from utils import load_env, load_abi, connect, format_matic


# ── Simulation Parameters ──────────────────────────────────────────
NUM_BATCHES = 10
NUM_FLAGS = 2

# Vietnam agricultural scaling assumptions
ANNUAL_PRODUCE_TONS = 10_000_000       # 10M+ metric tons/year
AVG_BATCH_KG = 500                     # Average batch size
ANNUAL_BATCHES = ANNUAL_PRODUCE_TONS * 1000 // AVG_BATCH_KG  # ~20M
TX_PER_BATCH = 2                       # Hybrid model: 2 on-chain tx/batch
ANNUAL_TX = ANNUAL_BATCHES * TX_PER_BATCH  # ~40M
SECONDS_PER_YEAR = 365 * 24 * 3600
POLYGON_TPS = 1000                     # Post-Bhilai capacity

# Cost range per tx in USD (Polygon Amoy estimates)
COST_LOW_PER_TX = 0.0005
COST_HIGH_PER_TX = 0.002


def send_tx(w3, contract, func, account, private_key):
    """Build, sign, send a transaction and return receipt + gas used."""
    tx = func.build_transaction({
        "from": account.address,
        "nonce": w3.eth.get_transaction_count(account.address),
        "gasPrice": w3.eth.gas_price,
    })
    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    return receipt


def grant_roles(w3, contract, admin_account):
    """Grant all supply-chain roles to admin so simulation can act as any participant."""
    roles = ["PRODUCER_ROLE", "LOGISTICS_ROLE", "RETAILER_ROLE", "AUDITOR_ROLE"]
    for role_name in roles:
        role_hash = contract.functions[role_name]().call()
        has_role = contract.functions.hasRole(role_hash, admin_account.address).call()
        if not has_role:
            func = contract.functions.grantRole(role_hash, admin_account.address)
            tx = func.build_transaction({
                "from": admin_account.address,
                "nonce": w3.eth.get_transaction_count(admin_account.address),
                "gasPrice": w3.eth.gas_price,
            })
            signed = admin_account.sign_transaction(tx)
            tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
            w3.eth.wait_for_transaction_receipt(tx_hash)
            print(f"  Granted {role_name}")
        else:
            print(f"  {role_name} already granted")


def main():
    env = load_env()
    # Use local Hardhat node for simulation
    rpc_url = env["HARDHAT_RPC_URL"]
    private_key = env["HARDHAT_PRIVATE_KEY"]
    contract_address = env["CONTRACT_ADDRESS"]

    if not all([rpc_url, private_key, contract_address]):
        print("ERROR: Set HARDHAT_RPC_URL, HARDHAT_PRIVATE_KEY, and CONTRACT_ADDRESS in .env")
        sys.exit(1)

    w3 = connect(rpc_url)
    account = w3.eth.account.from_key(private_key)
    abi = load_abi()
    contract = w3.eth.contract(
        address=Web3.to_checksum_address(contract_address), abi=abi
    )

    print("\nSetting up roles for simulation account...")
    grant_roles(w3, contract, account)

    gas_price = w3.eth.gas_price
    print(f"\nCurrent gas price: {gas_price} wei ({format_matic(gas_price)})\n")

    # ── Phase 1: Register test batches ──────────────────────────────
    print("=" * 60)
    print(f"Phase 1: Registering {NUM_BATCHES} test batches")
    print("=" * 60)

    register_gas = []
    batch_ids = []

    for i in range(NUM_BATCHES):
        product = f"TestProduct_{i}"
        origin = f"TestOrigin_{i}"
        harvest_date = int(time.time()) - (i * 86400)

        func = contract.functions.registerBatch(
            product, origin, harvest_date, 500000, True, ""
        )
        receipt = send_tx(w3, contract, func, account, private_key)
        gas_used = receipt["gasUsed"]
        register_gas.append(gas_used)

        # Extract batchId from event logs
        logs = contract.events.BatchRegistered().process_receipt(receipt)
        batch_id = logs[0]["args"]["batchId"]
        batch_ids.append(batch_id)

        print(f"  Batch {i}: gas={gas_used}, id={batch_id.hex()[:16]}...")

    # ── Phase 2: Full checkpoint flow per batch ─────────────────────
    print(f"\nPhase 2: Logging checkpoints (PROCESSED->PACKED->SHIPPED->RECEIVED)")

    checkpoint_gas = []
    # ActionType: PROCESSED=1, PACKED=2, SHIPPED=3, RECEIVED=4
    actions = [
        (1, "Processing Center"),
        (2, "Packing Facility"),
        (3, "Logistics Hub"),
        (4, "Retail Store"),
    ]

    for i, batch_id in enumerate(batch_ids):
        for action_type, location in actions:
            func = contract.functions.logCheckpoint(
                batch_id, action_type, location, ""
            )
            receipt = send_tx(w3, contract, func, account, private_key)
            checkpoint_gas.append(receipt["gasUsed"])

        print(f"  Batch {i}: 4 checkpoints logged")

    # ── Phase 3: Flag sample batches ────────────────────────────────
    print(f"\nPhase 3: Flagging {NUM_FLAGS} batches")

    flag_gas = []
    for i in range(NUM_FLAGS):
        func = contract.functions.flagBatch(
            batch_ids[i], f"Simulation audit flag #{i}"
        )
        receipt = send_tx(w3, contract, func, account, private_key)
        flag_gas.append(receipt["gasUsed"])
        print(f"  Flagged batch {i}: gas={receipt['gasUsed']}")

    # ── Phase 4: Verify completeness via getHistory ─────────────────
    print(f"\nPhase 4: Verifying getHistory for all batches")

    for i, batch_id in enumerate(batch_ids):
        batch, cps, flags = contract.functions.getHistory(batch_id).call()
        expected_cps = 5  # HARVESTED(auto) + 4 checkpoints
        expected_flags = 1 if i < NUM_FLAGS else 0
        assert len(cps) == expected_cps, f"Batch {i}: expected {expected_cps} checkpoints, got {len(cps)}"
        assert len(flags) == expected_flags, f"Batch {i}: expected {expected_flags} flags, got {len(flags)}"
        print(f"  Batch {i}: {len(cps)} checkpoints, {len(flags)} flags OK")

    # ── Phase 5: Calculate averages ─────────────────────────────────
    avg_register = sum(register_gas) / len(register_gas)
    avg_checkpoint = sum(checkpoint_gas) / len(checkpoint_gas)
    avg_flag = sum(flag_gas) / len(flag_gas)

    # ── Phase 6: Scaling projections ────────────────────────────────
    required_tps = ANNUAL_TX / SECONDS_PER_YEAR
    headroom = POLYGON_TPS / required_tps
    cost_low = ANNUAL_TX * COST_LOW_PER_TX
    cost_high = ANNUAL_TX * COST_HIGH_PER_TX

    # ── Output: formatted table ─────────────────────────────────────
    print("\n" + "=" * 60)
    print("SIMULATION RESULTS")
    print("=" * 60)

    gas_table = [
        ["registerBatch", f"{avg_register:.0f}", format_matic(int(avg_register * gas_price))],
        ["logCheckpoint", f"{avg_checkpoint:.0f}", format_matic(int(avg_checkpoint * gas_price))],
        ["flagBatch", f"{avg_flag:.0f}", format_matic(int(avg_flag * gas_price))],
    ]
    print("\nGas Costs (averages):")
    print(tabulate(gas_table, headers=["Function", "Avg Gas", "Avg Cost"], tablefmt="grid"))

    scaling_table = [
        ["Annual produce", f"{ANNUAL_PRODUCE_TONS:,} metric tons"],
        ["Annual batches", f"{ANNUAL_BATCHES:,}"],
        ["Annual transactions", f"{ANNUAL_TX:,}"],
        ["Required TPS", f"{required_tps:.2f}"],
        ["Polygon capacity", f"{POLYGON_TPS:,} TPS"],
        ["Headroom factor", f"{headroom:.0f}x"],
        ["Annual cost (low)", f"${cost_low:,.0f}"],
        ["Annual cost (high)", f"${cost_high:,.0f}"],
    ]
    print("\nScaling Projections (Vietnam nationwide):")
    print(tabulate(scaling_table, headers=["Metric", "Value"], tablefmt="grid"))

    # ── Output: JSON results ────────────────────────────────────────
    results = {
        "simulation": {
            "num_batches": NUM_BATCHES,
            "num_flags": NUM_FLAGS,
            "gas_price_wei": gas_price,
        },
        "gas_costs": {
            "registerBatch": {
                "avg": round(avg_register),
                "min": min(register_gas),
                "max": max(register_gas),
                "samples": register_gas,
            },
            "logCheckpoint": {
                "avg": round(avg_checkpoint),
                "min": min(checkpoint_gas),
                "max": max(checkpoint_gas),
                "samples": checkpoint_gas,
            },
            "flagBatch": {
                "avg": round(avg_flag),
                "min": min(flag_gas),
                "max": max(flag_gas),
                "samples": flag_gas,
            },
        },
        "scaling": {
            "annual_produce_tons": ANNUAL_PRODUCE_TONS,
            "avg_batch_kg": AVG_BATCH_KG,
            "annual_batches": ANNUAL_BATCHES,
            "tx_per_batch": TX_PER_BATCH,
            "annual_tx": ANNUAL_TX,
            "required_tps": round(required_tps, 2),
            "polygon_tps": POLYGON_TPS,
            "headroom_factor": round(headroom),
            "annual_cost_low_usd": cost_low,
            "annual_cost_high_usd": cost_high,
        },
    }

    output_path = Path(__file__).parent.parent / "simulation-results.json"
    with open(output_path, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nResults saved to {output_path}")


if __name__ == "__main__":
    main()
