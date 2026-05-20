import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Contract } from "ethers";
import { useBatchHistory } from "../hooks/useBatchHistory";
import { getReadOnlyContract } from "../hooks/useContract";
import AuditTimeline from "../components/AuditTimeline";
import FlaggedBanner from "../components/FlaggedBanner";
import QRCodeDisplay from "../components/QRCodeDisplay";
import { addressLink } from "../config/chains";
import { useI18n } from "../i18n/I18nContext";
import { useRecentBatches } from "../hooks/useRecentBatches";
import { QUANTITY_UNIT_SYMBOL } from "../types";
import { isValidBatchId } from "../lib/batchId";

// Shared input className
const INPUT_CLASS =
  "w-full px-3 py-2 text-sm border border-gray-300 rounded-md " +
  "focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none";

// PublicTrace: consumer-facing view that works without a connected wallet.
// Reads via a stateless JSON-RPC provider for zero-friction QR scanning.
export default function PublicTrace() {
  const { batchId: paramBatchId } = useParams<{ batchId?: string }>();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { recent, addRecent, clearRecent } = useRecentBatches();

  // Search input state (only used when no URL param is present)
  const [searchInput, setSearchInput] = useState("");

  // Read-only contract created once and shared across renders
  const contract = useMemo<Contract>(() => getReadOnlyContract(), []);

  const isValidId = isValidBatchId(paramBatchId);

  const history = useBatchHistory(contract, isValidId ? paramBatchId : undefined);

  // Whenever we successfully load a batch, push it to recent history
  useEffect(() => {
    if (isValidId && history.batch && paramBatchId) {
      addRecent({ id: paramBatchId, name: history.batch.productName });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history.batch, paramBatchId, isValidId]);

  // Submit handler navigates to /trace/:batchId so the URL is shareable
  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchInput.trim();
    if (!trimmed) return;
    navigate(`/trace/${trimmed}`);
  };

  // Sync any URL param into the search box for editing
  useEffect(() => {
    if (paramBatchId) setSearchInput(paramBatchId);
  }, [paramBatchId]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header className="text-center">
        <h1 className="text-3xl sm:text-4xl font-semibold text-gray-900">
          {t("trace.title")}
        </h1>
        <p className="text-sm text-gray-500 mt-2">
          {t("trace.subtitle")}
        </p>
      </header>

      {/* Search bar — always visible so users can switch batches */}
      <form onSubmit={onSearch} className="flex gap-2 max-w-2xl mx-auto">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t("trace.searchPlaceholder")}
          className={`${INPUT_CLASS} font-mono text-xs`}
        />
        <button
          type="submit"
          className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-md text-sm font-medium shrink-0"
        >
          {t("trace.searchBtn")}
        </button>
      </form>

      {/* Initial empty state — show recent history if any */}
      {!paramBatchId && (
        <div className="space-y-4">
          <div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
            <p className="text-gray-600">{t("trace.emptyState")}</p>
          </div>

          {recent.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">{t("trace.recentLabel")}</h3>
                <button
                  type="button"
                  onClick={clearRecent}
                  className="text-xs text-gray-500 hover:text-red-600 transition-colors"
                >
                  {t("trace.clearRecent")}
                </button>
              </div>
              <ul className="space-y-1">
                {recent.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/trace/${r.id}`)}
                      className="w-full text-left flex items-center justify-between gap-3 px-3 py-2 rounded-md hover:bg-gray-50 transition-colors"
                    >
                      <span className="text-sm text-gray-900 truncate">{r.name}</span>
                      <span className="text-xs text-gray-400 font-mono shrink-0">
                        {r.id.slice(0, 6)}…{r.id.slice(-4)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Invalid format hint — shown while user is still editing */}
      {paramBatchId && !isValidId && (
        <div className="rounded-md bg-yellow-50 border border-yellow-200 p-6 text-center">
          <p className="text-yellow-800 font-medium">{t("trace.invalidFormat")}</p>
          <p className="text-sm text-yellow-700 mt-1">{t("trace.invalidFormatMsg")}</p>
        </div>
      )}

      {isValidId && history.loading && (
        <div className="text-center py-16">
          <p className="text-gray-500">{t("trace.loadingHistory")}</p>
        </div>
      )}

      {isValidId && !history.loading && history.error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-6 text-center">
          <p className="text-red-800 font-medium">{t("trace.notFoundTitle")}</p>
          <p className="text-sm text-red-700 mt-2">
            {history.error.includes("BatchNotFound") || history.error.includes("does not exist")
              ? t("trace.notFoundMsg")
              : history.error.includes("fetch") || history.error.includes("network") || history.error.includes("Network")
              ? t("trace.networkError")
              : history.error}
          </p>
          <p className="text-xs text-red-500 mt-2 font-mono break-all">{history.error}</p>
        </div>
      )}

      {isValidId && history.batch && !history.loading && (
        <div className="space-y-6 animate-fadeIn">
          {/* Flagged alert sits above all content for maximum visibility */}
          {history.batch.flagged && history.auditFlags.length > 0 && (
            <FlaggedBanner
              flag={history.auditFlags[history.auditFlags.length - 1]}
            />
          )}

          {/* Batch info card — hero panel for consumer */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2">
              {/* Product image — full-bleed on mobile, left half on desktop */}
              <div className="aspect-square md:aspect-auto bg-gradient-to-br from-green-50 to-emerald-100">
                {history.imageUrls.batchImage ? (
                  <img
                    src={history.imageUrls.batchImage}
                    alt={history.batch.productName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-green-600">
                    <svg className="w-20 h-20 opacity-40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19.2 2.96a1 1 0 0 1 1.8.66c0 1.2-.07 4.91-.6 7.2A7.3 7.3 0 0 1 13 16" />
                    </svg>
                  </div>
                )}
              </div>

              <div className="p-6 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-2xl font-semibold text-gray-900">
                    {history.batch.productName}
                  </h2>
                  {history.batch.ocop && (
                    <span className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
                      OCOP
                    </span>
                  )}
                </div>

                <InfoRow label={t("register.origin")} value={history.batch.origin} />
                <InfoRow
                  label={t("register.harvestDate")}
                  value={new Date(
                    Number(history.batch.harvestDate) * 1000
                  ).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                />
                <InfoRow
                  label={t("register.quantity")}
                  value={`${history.batch.quantity.toString()} ${QUANTITY_UNIT_SYMBOL[history.batch.unit]}`}
                />
                <AddressRow label="Producer" address={history.batch.producer} />
              </div>
            </div>
          </div>

          {/* Direct-sale message — registered but never handed off */}
          {history.checkpoints.length === 1 && (
            <div className="rounded-md bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800">
              {t("trace.directSale")}
            </div>
          )}

          {/* Timeline */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {t("trace.timelineTitle")}
            </h3>
            <AuditTimeline
              checkpoints={history.checkpoints}
              imageUrls={history.imageUrls.checkpointImages}
            />
          </div>

          {/* QR code for sharing this trace URL */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <QRCodeDisplay batchId={paramBatchId!} />
          </div>
        </div>
      )}
    </div>
  );
}

// Simple label/value row used inside the hero card
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-sm text-gray-900">{value}</p>
    </div>
  );
}

// Address row — truncates middle and provides explorer link + copy button
function AddressRow({ label, address }: { label: string; address: string }) {
  const [copied, setCopied] = useState(false);
  const truncated = `${address.slice(0, 6)}…${address.slice(-4)}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API may be unavailable in some browsers — fail silently
    }
  };

  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <div className="flex items-center gap-2">
        <a
          href={addressLink(address)}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-sm text-gray-900 hover:text-green-700"
        >
          {truncated}
        </a>
        <button
          type="button"
          onClick={copy}
          className="text-xs text-gray-500 hover:text-green-700"
        >
          {copied ? "✓ copied" : "copy"}
        </button>
      </div>
    </div>
  );
}
