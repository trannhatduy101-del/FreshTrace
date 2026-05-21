import { useCallback, useState } from "react";
import { pinata, ipfsUrl } from "../config/pinata";

// Hook wrapping Pinata SDK with React-friendly loading/error state.
// All uploads happen straight from the browser, no backend in between.
export function usePinata() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Upload a single file (image, PDF, etc.) to Pinata, returns the CID
  const uploadFile = useCallback(async (file: File): Promise<string> => {
    setLoading(true);
    setError(null);
    try {
      const result = await pinata.upload.file(file);
      // SDK returns { IpfsHash, PinSize, Timestamp, ... }
      return result.IpfsHash;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  // Upload arbitrary JSON metadata; useful for off-chain extended info
  const uploadJSON = useCallback(async (data: object): Promise<string> => {
    setLoading(true);
    setError(null);
    try {
      const result = await pinata.upload.json(data);
      return result.IpfsHash;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  // Build a gateway HTTPS URL for a given CID (synchronous helper)
  const getFileUrl = useCallback((cid: string): string => ipfsUrl(cid), []);

  return { uploadFile, uploadJSON, getFileUrl, loading, error };
}
