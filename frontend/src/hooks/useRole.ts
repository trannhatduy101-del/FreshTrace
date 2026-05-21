import { useEffect, useState } from "react";
import { ethers, Contract } from "ethers";

// Bytes32 role identifiers, mirrored from the contract constants.
// DEFAULT_ADMIN_ROLE in OpenZeppelin AccessControl is bytes32(0).
const ROLES = {
  PRODUCER: ethers.id("PRODUCER_ROLE"),
  LOGISTICS: ethers.id("LOGISTICS_ROLE"),
  RETAILER: ethers.id("RETAILER_ROLE"),
  AUDITOR: ethers.id("AUDITOR_ROLE"),
  ADMIN: ethers.ZeroHash,
};

export interface RoleState {
  isProducer: boolean;
  isLogistics: boolean;
  isRetailer: boolean;
  isAuditor: boolean;
  isAdmin: boolean;
  loading: boolean;
}

// Query all role memberships in parallel for the given wallet address.
// Re-runs whenever address or contract reference changes.
export function useRole(
  contract: Contract | null,
  address: string | undefined
): RoleState {
  const [state, setState] = useState<RoleState>({
    isProducer: false,
    isLogistics: false,
    isRetailer: false,
    isAuditor: false,
    isAdmin: false,
    loading: false,
  });

  useEffect(() => {
    // Reset when wallet disconnects so guarded UI re-locks
    if (!contract || !address) {
      setState({
        isProducer: false,
        isLogistics: false,
        isRetailer: false,
        isAuditor: false,
        isAdmin: false,
        loading: false,
      });
      return;
    }

    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));

    // Fire all hasRole calls in parallel so the user waits for one round trip, not five.
    Promise.all([
      contract.hasRole(ROLES.PRODUCER, address),
      contract.hasRole(ROLES.LOGISTICS, address),
      contract.hasRole(ROLES.RETAILER, address),
      contract.hasRole(ROLES.AUDITOR, address),
      contract.hasRole(ROLES.ADMIN, address),
    ])
      .then(([producer, logistics, retailer, auditor, admin]) => {
        if (cancelled) return;
        setState({
          isProducer: Boolean(producer),
          isLogistics: Boolean(logistics),
          isRetailer: Boolean(retailer),
          isAuditor: Boolean(auditor),
          isAdmin: Boolean(admin),
          loading: false,
        });
      })
      .catch((err) => {
        console.error("[useRole] hasRole call failed:", err?.message ?? err);
        if (cancelled) return;
        setState({
          isProducer: false,
          isLogistics: false,
          isRetailer: false,
          isAuditor: false,
          isAdmin: false,
          loading: false,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [contract, address]);

  return state;
}
