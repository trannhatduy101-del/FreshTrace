import { useI18n } from "../i18n/I18nContext";
import { friendlyError } from "../lib/errorMessages";

interface ErrorMessageProps {
  /** Raw error string from a tx hook (e.g. useTransaction state.error). */
  error: string | null;
  /** Optional className to control sizing/spacing in the parent. */
  className?: string;
  /** Compact variant: single line, no raw details. */
  compact?: boolean;
}

// Universal error display: classifies the raw error, shows a friendly
// translated message, and (in normal mode) the raw text in small grey
// so devs can debug without surprising users.
export default function ErrorMessage({ error, className = "", compact = false }: ErrorMessageProps) {
  const { t } = useI18n();
  if (!error) return null;

  const { message, raw } = friendlyError(error, t);
  // Show raw only if it differs meaningfully from the friendly message.
  const showRaw = !compact && raw && raw !== message && raw.length < 400;

  return (
    <div className={`rounded-md bg-red-50 border border-red-200 p-3 ${className}`}>
      <p className="text-sm text-red-800 font-medium">{message}</p>
      {showRaw && (
        <p className="text-xs text-red-500 mt-1 font-mono break-all">{raw}</p>
      )}
    </div>
  );
}
