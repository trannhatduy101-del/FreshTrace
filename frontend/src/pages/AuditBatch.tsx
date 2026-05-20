import { useEffect, useState } from "react";
import { useWalletAccount } from "../hooks/useWallet";
import { useContract } from "../hooks/useContract";
import { useRole } from "../hooks/useRole";
import { useFlagBatch } from "../hooks/useFlagBatch";
import { useResolveFlag } from "../hooks/useResolveFlag";
import { useBatchHistory } from "../hooks/useBatchHistory";
import AuditTimeline from "../components/AuditTimeline";
import FlaggedBanner from "../components/FlaggedBanner";
import { txLink } from "../config/chains";
import { Batch, QuantityUnit } from "../types";

interface BatchRow {
  id: string;
  batch: Batch;
  flagCount: number;
}

const INPUT_CLASS =
  "w-full px-3 py-2 text-sm border border-gray-300 rounded-md " +
  "focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none";

export default function AuditBatch() {
  const { contract, isConnected } = useContract();
  const { address } = useWalletAccount();
  const role = useRole(contract, address);

  const [rows, setRows] = useState<BatchRow[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Load all batches on mount / contract change
  useEffect(() => {
    if (!contract) return;
    let cancelled = false;
    setLoadingList(true);
    setListError(null);

    (async () => {
      try {
        const ids: string[] = await contract.getBatchIds();
        const histories = await Promise.all(ids.map((id) => contract.getHistory(id)));
        if (cancelled) return;
        setRows(
          ids.map((id, i) => {
            const [rawBatch, , rawFlags] = histories[i];
            return {
              id,
              batch: {
                productName: rawBatch.productName,
                origin: rawBatch.origin,
                harvestDate: rawBatch.harvestDate,
                quantity: rawBatch.quantity,
                unit: Number(rawBatch.unit ?? 0) as QuantityUnit,
                producer: rawBatch.producer,
                ocop: rawBatch.ocop,
                exists: rawBatch.exists,
                flagged: rawBatch.flagged,
                ipfsHash: rawBatch.ipfsHash,
              },
              flagCount: rawFlags.length,
            };
          })
        );
      } catch (e) {
        if (!cancelled)
          setListError(e instanceof Error ? e.message : "Failed to load batches");
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    })();

    return () => { cancelled = true; };
  }, [contract]);

  if (!isConnected)
    return <Guard title="Wallet required" body="Connect your wallet to access Audit." />;
  if (role.loading)
    return <Guard title="Checking permissions…" body="Verifying your role on the contract." />;
  if (!role.isAuditor)
    return <Guard title="Auditor role required" body="Only AUDITOR_ROLE wallets can access this page." />;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">Audit Batches</h1>
        <p className="text-sm text-gray-500 mt-1">
          Auditor-only · Review supply chain history and flag suspicious batches.
        </p>
      </header>

      {listError && (
        <div className="rounded-md bg-red-50 border border-red-200 p-4 text-sm text-red-800">
          {listError}
        </div>
      )}

      {loadingList && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-100 p-4 animate-pulse">
              <div className="h-4 bg-gray-100 rounded w-1/3 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-1/4" />
            </div>
          ))}
        </div>
      )}

      {!loadingList && rows.length === 0 && !listError && (
        <div className="text-center py-16 bg-white rounded-lg border border-dashed border-gray-300">
          <p className="text-gray-600">No batches registered yet.</p>
        </div>
      )}

      {!loadingList && rows.length > 0 && (
        <div className="space-y-3">
          {rows.map((row) => (
            <BatchAuditRow
              key={row.id}
              row={row}
              contract={contract}
              expanded={expandedId === row.id}
              onToggle={() =>
                setExpandedId((prev) => (prev === row.id ? null : row.id))
              }
              onFlagSuccess={(updatedRow) =>
                setRows((prev) =>
                  prev.map((r) => (r.id === updatedRow.id ? updatedRow : r))
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Per-batch accordion row ────────────────────────────────────────────────

function BatchAuditRow({
  row,
  contract,
  expanded,
  onToggle,
  onFlagSuccess,
}: {
  row: BatchRow;
  contract: any;
  expanded: boolean;
  onToggle: () => void;
  onFlagSuccess: (updated: BatchRow) => void;
}) {
  const history = useBatchHistory(expanded ? contract : null, expanded ? row.id : undefined);
  const { flagBatch, reset, loading, success, error, txHash } = useFlagBatch(contract);
  const { resolveFlag, loading: resolving } = useResolveFlag(contract);
  const [reason, setReason] = useState("");

  const onResolve = async (flagIndex: number) => {
    await resolveFlag(row.id, flagIndex);
    history.refresh();
    // Re-check if all flags resolved to update parent badge
    const allResolved = history.auditFlags.every((f, i) => i === flagIndex || f.resolved);
    if (allResolved) onFlagSuccess({ ...row, batch: { ...row.batch, flagged: false } });
  };

  const harvestStr = new Date(Number(row.batch.harvestDate) * 1000).toLocaleDateString(
    undefined,
    { year: "numeric", month: "short", day: "numeric" }
  );

  const onSubmitFlag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    await flagBatch(row.id, reason.trim());
  };

  // After a successful flag, refresh history and notify parent
  useEffect(() => {
    if (success) {
      history.refresh();
      onFlagSuccess({ ...row, batch: { ...row.batch, flagged: true }, flagCount: row.flagCount + 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [success]);

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Collapsed header — always visible */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
              row.batch.flagged
                ? "bg-red-100 text-red-800"
                : "bg-green-100 text-green-800"
            }`}
          >
            {row.batch.flagged ? "Flagged" : "Active"}
          </span>
          <span className="font-medium text-gray-900 truncate">{row.batch.productName}</span>
          <span className="text-sm text-gray-500 hidden sm:inline truncate">{row.batch.origin}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-3">
          <span className="text-xs text-gray-500">{harvestStr}</span>
          {row.flagCount > 0 && (
            <span className="text-xs font-medium text-red-600">
              {row.flagCount} flag{row.flagCount > 1 ? "s" : ""}
            </span>
          )}
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded detail panel */}
      {expanded && (
        <div className="border-t border-gray-100 px-5 py-5 space-y-6">
          {/* Batch ID */}
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Batch ID</p>
            <p className="font-mono text-xs text-gray-700 break-all">{row.id}</p>
          </div>

          {/* All audit flags with resolve buttons */}
          {history.auditFlags.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Audit Flags ({history.auditFlags.length})
              </p>
              {history.auditFlags.map((flag, i) => (
                <FlaggedBanner
                  key={i}
                  flag={flag}
                  onResolve={flag.resolved ? undefined : () => onResolve(i)}
                  resolving={resolving}
                />
              ))}
            </div>
          )}

          {/* Timeline */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Supply Chain Timeline</h3>
            {history.loading && <p className="text-sm text-gray-500">Loading…</p>}
            {history.error && <p className="text-sm text-red-600">Could not load history.</p>}
            {!history.loading && history.checkpoints.length > 0 && (
              <AuditTimeline
                checkpoints={history.checkpoints}
                imageUrls={history.imageUrls.checkpointImages}
              />
            )}
          </div>

          {/* Flag form */}
          <div className="border-t border-gray-100 pt-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Flag This Batch</h3>

            {success && txHash ? (
              <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800 animate-fadeIn">
                <p className="font-medium">Batch flagged on-chain.</p>
                <a
                  href={txLink(txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-mono break-all hover:underline"
                >
                  {txHash} ↗
                </a>
                <button
                  type="button"
                  onClick={() => { reset(); setReason(""); }}
                  className="block mt-2 text-xs text-red-700 hover:underline"
                >
                  Flag again →
                </button>
              </div>
            ) : (
              <form onSubmit={onSubmitFlag} className="flex gap-2">
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason for flagging (e.g. temperature excursion, missing cert)"
                  required
                  className={INPUT_CLASS}
                />
                <button
                  type="submit"
                  disabled={loading || !reason.trim()}
                  className="shrink-0 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  {loading ? "Flagging…" : "Flag"}
                </button>
              </form>
            )}

            {error && (
              <p className="mt-2 text-sm text-red-600">{error}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Guard({ title, body }: { title: string; body: string }) {
  return (
    <div className="max-w-md mx-auto text-center py-16">
      <h2 className="text-xl font-semibold text-gray-900 mb-2">{title}</h2>
      <p className="text-gray-600">{body}</p>
    </div>
  );
}
