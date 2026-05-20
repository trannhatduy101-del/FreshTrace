/**
 * Shared types between smart contract layer and frontend.
 * Generated from FreshTrace.sol — keep in sync with contract.
 */

export enum ActionType {
  HARVESTED = 0,
  PROCESSED = 1,
  PACKED = 2,
  SHIPPED = 3,
  RECEIVED = 4,
}

export interface Batch {
  productName: string;
  origin: string;
  harvestDate: bigint;
  quantity: bigint;
  producer: string;
  ocop: boolean;
  exists: boolean;
  flagged: boolean;
  ipfsHash: string;
}

export interface Checkpoint {
  actor: string;
  location: string;
  timestamp: bigint;
  action: ActionType;
  ipfsHash: string;
}

export interface AuditFlag {
  auditor: string;
  reason: string;
  timestamp: bigint;
}

// Human-readable labels for UI display
export const ACTION_LABELS: Record<ActionType, string> = {
  [ActionType.HARVESTED]: "Harvested",
  [ActionType.PROCESSED]: "Processed",
  [ActionType.PACKED]: "Packed",
  [ActionType.SHIPPED]: "Shipped",
  [ActionType.RECEIVED]: "Received",
};
