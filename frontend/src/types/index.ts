// Shared types provided by the smart contract team (Prompt A output).
// Keep this file in sync with the deployed FreshTrace.sol contract.

// Lifecycle stages a batch passes through.
// HARVESTED (0) is auto-created by registerBatch and never selectable in UI.
export enum ActionType {
  HARVESTED = 0,
  PROCESSED = 1,
  PACKED = 2,
  SHIPPED = 3,
  RECEIVED = 4,
}

// Unit in which Batch.quantity is measured.
// Mirrors the contract enum: GRAMS=0, KILOGRAMS=1.
export enum QuantityUnit {
  GRAMS = 0,
  KILOGRAMS = 1,
}

export const QUANTITY_UNIT_SYMBOL: Record<QuantityUnit, string> = {
  [QuantityUnit.GRAMS]: "g",
  [QuantityUnit.KILOGRAMS]: "kg",
};

// Core batch record stored on-chain. bigint used for uint256 fields.
export interface Batch {
  productName: string;
  origin: string;
  harvestDate: bigint;
  quantity: bigint;
  unit: QuantityUnit;
  producer: string;
  ocop: boolean;
  exists: boolean;
  flagged: boolean;
  ipfsHash: string;
}

// Single supply-chain event appended to a batch's history.
export interface Checkpoint {
  actor: string;
  location: string;
  timestamp: bigint;
  action: ActionType;
  ipfsHash: string;
  addonLabel: string; // empty = main flow, non-empty = add-on process
}

// Auditor's flag attached to a batch when investigation is triggered.
export interface AuditFlag {
  auditor: string;
  reason: string;
  timestamp: bigint;
  resolved: boolean;
  resolvedBy: string;
  resolvedAt: bigint;
}

// Human-readable labels for each ActionType, used across timeline + dropdowns.
export const ACTION_LABELS: Record<ActionType, string> = {
  [ActionType.HARVESTED]: "Harvested",
  [ActionType.PROCESSED]: "Processed",
  [ActionType.PACKED]: "Packed",
  [ActionType.SHIPPED]: "Shipped",
  [ActionType.RECEIVED]: "Received",
};

// Tailwind background classes per action for consistent timeline color-coding.
export const ACTION_COLORS: Record<ActionType, string> = {
  [ActionType.HARVESTED]: "bg-green-500",
  [ActionType.PROCESSED]: "bg-blue-500",
  [ActionType.PACKED]: "bg-purple-500",
  [ActionType.SHIPPED]: "bg-orange-500",
  [ActionType.RECEIVED]: "bg-teal-500",
};

// Convenience: list of actions selectable in LogCheckpoint dropdown
// (excludes HARVESTED which only the contract may emit).
export const SELECTABLE_ACTIONS: ActionType[] = [
  ActionType.PROCESSED,
  ActionType.PACKED,
  ActionType.SHIPPED,
  ActionType.RECEIVED,
];

// Image URL bundle returned by useBatchHistory for rendering convenience.
export interface BatchImageUrls {
  batchImage: string | null;
  checkpointImages: (string | null)[];
}
