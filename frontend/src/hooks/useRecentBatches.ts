import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "freshtrace.recentBatches";
const MAX_ITEMS = 5;

export interface RecentBatch {
  id: string;      // bytes32 hex
  name: string;    // human-readable product name for display
  viewedAt: number; // unix ms, used to sort newest first
}

// Reads the stored list, validating shape so a corrupted entry doesn't crash.
function loadFromStorage(): RecentBatch[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r): r is RecentBatch =>
        r && typeof r.id === "string" && typeof r.name === "string" && typeof r.viewedAt === "number"
    );
  } catch {
    return [];
  }
}

/**
 * Tracks recently-viewed batches in localStorage so users don't need to
 * re-paste the 66-character batch ID every time. Stays on the device:
 * no server storage, no analytics, purely a UX convenience.
 */
export function useRecentBatches() {
  const [recent, setRecent] = useState<RecentBatch[]>(loadFromStorage);

  // Persist any change back to localStorage immediately.
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(recent)); } catch {}
  }, [recent]);

  const addRecent = useCallback((entry: { id: string; name: string }) => {
    setRecent((prev) => {
      const without = prev.filter((r) => r.id.toLowerCase() !== entry.id.toLowerCase());
      const next = [{ ...entry, viewedAt: Date.now() }, ...without];
      return next.slice(0, MAX_ITEMS);
    });
  }, []);

  const clearRecent = useCallback(() => setRecent([]), []);

  return { recent, addRecent, clearRecent };
}
