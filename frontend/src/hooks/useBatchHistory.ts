import { useCallback, useEffect, useState } from "react";
import { Contract } from "ethers";
import {
  Batch,
  Checkpoint,
  AuditFlag,
  ActionType,
  BatchImageUrls,
} from "../types";
import { ipfsUrl } from "../config/pinata";

interface HistoryState {
  batch: Batch | null;
  checkpoints: Checkpoint[];
  auditFlags: AuditFlag[];
  imageUrls: BatchImageUrls;
  loading: boolean;
  error: string | null;
}

const EMPTY_URLS: BatchImageUrls = { batchImage: null, checkpointImages: [] };

// Fetch full audit history for a single batch and parse the tuple into typed
// shapes. Returns gateway-resolved image URLs alongside raw data for convenience.
export function useBatchHistory(
  contract: Contract | null,
  batchId: string | undefined
) {
  const [state, setState] = useState<HistoryState>({
    batch: null,
    checkpoints: [],
    auditFlags: [],
    imageUrls: EMPTY_URLS,
    loading: false,
    error: null,
  });

  // Extracted as callback so pages can manually refresh after writes
  const fetchHistory = useCallback(async () => {
    if (!contract || !batchId) return;
    setState((s) => ({ ...s, loading: true, error: null }));

    try {
      // Solidity getHistory returns a tuple: (Batch, Checkpoint[], AuditFlag[])
      const [rawBatch, rawCheckpoints, rawFlags] = await contract.getHistory(
        batchId
      );

      // Map raw struct arrays to typed objects (ethers v6 returns Result tuples)
      const batch: Batch = {
        productName: rawBatch.productName,
        origin: rawBatch.origin,
        harvestDate: rawBatch.harvestDate,
        quantity: rawBatch.quantity,
        producer: rawBatch.producer,
        ocop: rawBatch.ocop,
        exists: rawBatch.exists,
        flagged: rawBatch.flagged,
        ipfsHash: rawBatch.ipfsHash,
      };

      const checkpoints: Checkpoint[] = rawCheckpoints.map((c: any) => {
        // addonLabel was added in a later contract version; guard against
        // deferred ABI decode errors when reading older on-chain data.
        let addonLabel = "";
        try { addonLabel = c.addonLabel ?? ""; } catch { /* pre-addonLabel contract */ }
        return {
          actor: c.actor,
          location: c.location,
          timestamp: c.timestamp,
          action: Number(c.action) as ActionType,
          ipfsHash: c.ipfsHash,
          addonLabel,
        };
      });

      const auditFlags: AuditFlag[] = rawFlags.map((f: any) => ({
        auditor: f.auditor,
        reason: f.reason,
        timestamp: f.timestamp,
        resolved: f.resolved ?? false,
        resolvedBy: f.resolvedBy ?? "",
        resolvedAt: f.resolvedAt ?? 0n,
      }));

      // Resolve non-empty IPFS hashes to full gateway URLs once, up-front
      const imageUrls: BatchImageUrls = {
        batchImage: batch.ipfsHash ? ipfsUrl(batch.ipfsHash) : null,
        checkpointImages: checkpoints.map((c) =>
          c.ipfsHash ? ipfsUrl(c.ipfsHash) : null
        ),
      };

      setState({
        batch,
        checkpoints,
        auditFlags,
        imageUrls,
        loading: false,
        error: null,
      });
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Failed to load batch history";
      setState({
        batch: null,
        checkpoints: [],
        auditFlags: [],
        imageUrls: EMPTY_URLS,
        loading: false,
        error: msg,
      });
    }
  }, [contract, batchId]);

  // Auto-fetch on dependency change
  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return { ...state, refresh: fetchHistory };
}
