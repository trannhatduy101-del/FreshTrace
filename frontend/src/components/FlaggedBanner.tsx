import { AuditFlag } from "../types";
import { addressLink } from "../config/chains";

interface FlaggedBannerProps {
  flag: AuditFlag;
  /** If provided, renders a "Mark resolved" button for auditors */
  onResolve?: () => void;
  resolving?: boolean;
}

// Full-width alert: red for active flags, green for resolved ones.
// Shown on PublicTrace (consumers) and at the top of LogCheckpoint.
export default function FlaggedBanner({ flag, onResolve, resolving }: FlaggedBannerProps) {
  const when = fmt(flag.timestamp);
  const resolvedWhen = flag.resolved ? fmt(flag.resolvedAt) : null;

  if (flag.resolved) {
    return (
      <div className="rounded-md bg-green-50 border-l-4 border-green-500 p-4 flex items-start gap-3">
        <svg className="w-6 h-6 text-green-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div className="flex-1">
          <p className="text-sm font-semibold text-green-900">Flag resolved</p>
          <p className="text-sm text-green-800 mt-1">Original concern: {flag.reason}</p>
          <p className="text-xs text-green-700 mt-2">
            Resolved by{" "}
            <a href={addressLink(flag.resolvedBy)} target="_blank" rel="noopener noreferrer" className="font-mono hover:underline">
              {flag.resolvedBy.slice(0, 6)}…{flag.resolvedBy.slice(-4)}
            </a>{" "}
            on {resolvedWhen} · Originally flagged on {when}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md bg-red-50 border-l-4 border-red-500 p-4 flex items-start gap-3">
      <svg className="w-6 h-6 text-red-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M4.93 19h14.14a2 2 0 001.74-3L13.74 4a2 2 0 00-3.48 0L3.19 16a2 2 0 001.74 3z" />
      </svg>
      <div className="flex-1">
        <p className="text-sm font-semibold text-red-900">This batch has been flagged for investigation</p>
        <p className="text-sm text-red-800 mt-1">Reason: {flag.reason}</p>
        <p className="text-xs text-red-700 mt-2">
          Flagged by{" "}
          <a href={addressLink(flag.auditor)} target="_blank" rel="noopener noreferrer" className="font-mono hover:underline">
            {flag.auditor.slice(0, 6)}…{flag.auditor.slice(-4)}
          </a>{" "}
          on {when}
        </p>
        {onResolve && (
          <button
            type="button"
            onClick={onResolve}
            disabled={resolving}
            className="mt-3 text-xs font-medium px-3 py-1.5 rounded bg-red-100 hover:bg-red-200 text-red-800 disabled:opacity-50 transition-colors"
          >
            {resolving ? "Resolving…" : "Mark as Resolved"}
          </button>
        )}
      </div>
    </div>
  );
}

function fmt(ts: bigint): string {
  return new Date(Number(ts) * 1000).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}
