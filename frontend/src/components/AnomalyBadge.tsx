import { ActionType, ACTION_LABELS } from "../types";

interface AnomalyBadgeProps {
  attempted: ActionType;
  last: ActionType | -1; // -1 indicates "unknown" (revert-derived)
}

// Red warning displayed when a checkpoint submission is rejected for ordering.
// Shown both in client-side pre-checks and after a contract revert.
export default function AnomalyBadge({ attempted, last }: AnomalyBadgeProps) {
  const attemptedLabel = ACTION_LABELS[attempted];
  const lastLabel = last === -1 ? "the current state" : ACTION_LABELS[last as ActionType];

  return (
    <div className="rounded-md bg-amber-50 border border-amber-300 p-3 flex items-start gap-3">
      {/* Warning triangle icon */}
      <svg
        className="w-5 h-5 text-amber-600 shrink-0 mt-0.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v2m0 4h.01M5.07 19h13.86a2 2 0 001.74-3L13.74 4a2 2 0 00-3.48 0L3.34 16a2 2 0 001.73 3z"
        />
      </svg>
      <div>
        <p className="text-sm font-semibold text-amber-900">Anomaly detected</p>
        <p className="text-xs text-amber-800 mt-0.5">
          Attempted <strong>{attemptedLabel}</strong> after{" "}
          <strong>{lastLabel}</strong>. Checkpoints must move forward in the
          supply chain.
        </p>
      </div>
    </div>
  );
}
