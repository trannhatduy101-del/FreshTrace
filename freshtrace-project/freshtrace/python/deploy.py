"""Deploy FreshTrace to Polygon Amoy via web3.py and grant roles."""

import json
import sys
from pathlib import Path
from web3 import Web3
from utils import load_env, load_abi, load_bytecode, connect, format_matic


def main():
    env = load_env()
    rpc_url = env["POLYGON_AMOY_RPC_URL"]
    private_key = env["PRIVATE_KEY"]

    if not rpc_url or not private_key:
        print("ERROR: Set POLYGON_AMOY_RPC_URL and PRIVATE_KEY in .env")
        sys.exit(1)

    w3 = connect(rpc_url)
    account = w3.eth.account.from_key(private_key)
    print(f"Deploying from: {account.address}")

    # Load compiled contract from Hardhat artifacts
    abi = load_abi()
    bytecode = load_bytecode()

    # Deploy the contract
    FreshTrace = w3.eth.contract(abi=abi, bytecode=bytecode)
    tx = FreshTrace.constructor().build_transaction({
        "from": account.address,
        "nonce": w3.eth.get_transaction_count(account.address),
        "gasPrice": w3.eth.gas_price,
    })

    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    print(f"Deploy tx: {tx_hash.hex()}")

    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    contract_address = receipt["contractAddress"]
    print(f"FreshTrace deployed to: {contract_address}")
    print(f"Gas used: {receipt['gasUsed']} ({format_matic(receipt['gasUsed'] * w3.eth.gas_price)})")

    # Bind to deployed contract for role grants
    contract = w3.eth.contract(address=contract_address, abi=abi)

    # Grant roles to test wallets
    role_map = {
        "PRODUCER_ROLE": env["TEST_PRODUCER"],
        "LOGISTICS_ROLE": env["TEST_LOGISTICS"],
        "RETAILER_ROLE": env["TEST_RETAILER"],
        "AUDITOR_ROLE": env["TEST_AUDITOR"],
    }

    for role_name, wallet in role_map.items():
        if not wallet:
            print(f"Skipping {role_name} — address not set in .env")
            continue

        # Get the role hash from the contract
        role_hash = contract.functions[role_name]().call()
        grant_tx = contract.functions.grantRole(role_hash, wallet).build_transaction({
            "from": account.address,
            "nonce": w3.eth.get_transaction_count(account.address),
            "gasPrice": w3.eth.gas_price,
        })
        signed = account.sign_transaction(grant_tx)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        w3.eth.wait_for_transaction_receipt(tx_hash)
        print(f"Granted {role_name} to {wallet}")

    # Write deployments.json for frontend integration
    deployment = {
        "address": contract_address,
        "network": "amoy",
        "chainId": 80002,
        "deployer": account.address,
        "blockNumber": receipt["blockNumber"],
        "abi_path": "artifacts/contracts/FreshTrace.sol/FreshTrace.json",
    }

    output_path = Path(__file__).parent.parent / "deployments.json"
    with open(output_path, "w") as f:
        json.dump(deployment, f, indent=2)
    print(f"Saved {output_path}")


if __name__ == "__main__":
    main()
