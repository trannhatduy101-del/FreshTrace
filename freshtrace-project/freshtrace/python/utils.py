"""Shared utilities for FreshTrace Python tooling."""

import json
import os
from pathlib import Path
from dotenv import load_dotenv
from web3 import Web3


def load_env() -> dict:
    """Load and return all .env variables as a dictionary."""
    load_dotenv()
    return {
        "PRIVATE_KEY": os.getenv("PRIVATE_KEY", ""),
        "POLYGON_AMOY_RPC_URL": os.getenv("POLYGON_AMOY_RPC_URL", ""),
        "HARDHAT_RPC_URL": os.getenv("HARDHAT_RPC_URL", "http://127.0.0.1:8545"),
        "HARDHAT_PRIVATE_KEY": os.getenv("HARDHAT_PRIVATE_KEY", ""),
        "TEST_PRODUCER": os.getenv("TEST_PRODUCER", ""),
        "TEST_LOGISTICS": os.getenv("TEST_LOGISTICS", ""),
        "TEST_RETAILER": os.getenv("TEST_RETAILER", ""),
        "TEST_AUDITOR": os.getenv("TEST_AUDITOR", ""),
        "CONTRACT_ADDRESS": os.getenv("CONTRACT_ADDRESS", ""),
    }


def load_abi() -> list:
    """Read contract ABI from Hardhat compilation artifacts."""
    artifact_path = Path(__file__).parent.parent / "artifacts" / "contracts" / "FreshTrace.sol" / "FreshTrace.json"
    with open(artifact_path, "r") as f:
        artifact = json.load(f)
    return artifact["abi"]


def load_bytecode() -> str:
    """Read contract bytecode from Hardhat compilation artifacts."""
    artifact_path = Path(__file__).parent.parent / "artifacts" / "contracts" / "FreshTrace.sol" / "FreshTrace.json"
    with open(artifact_path, "r") as f:
        artifact = json.load(f)
    return artifact["bytecode"]


def connect(rpc_url: str) -> Web3:
    """Create and return a connected Web3 instance."""
    w3 = Web3(Web3.HTTPProvider(rpc_url))
    if not w3.is_connected():
        raise ConnectionError(f"Failed to connect to {rpc_url}")
    print(f"Connected to chain ID: {w3.eth.chain_id}")
    return w3


def get_contract(w3: Web3, address: str, abi: list):
    """Return a contract instance bound to a specific address."""
    return w3.eth.contract(address=Web3.to_checksum_address(address), abi=abi)


def format_matic(wei: int) -> str:
    """Convert Wei to human-readable MATIC string."""
    return f"{Web3.from_wei(wei, 'ether'):.6f} MATIC"
