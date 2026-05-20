// Shared batch-ID validation helper. Used by PublicTrace, LogCheckpoint,
// and anywhere else we need to gate RPC calls on a well-formed bytes32 hex.

export const BATCH_ID_PATTERN = /^0x[0-9a-fA-F]{64}$/;

export function isValidBatchId(id: string | undefined | null): boolean {
  if (!id) return false;
  return BATCH_ID_PATTERN.test(id);
}
