import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useWalletAccount } from "../hooks/useWallet";
import { useContract } from "../hooks/useContract";
import { useRole } from "../hooks/useRole";
import { useCheckpoint } from "../hooks/useCheckpoint";
import { useAddonCheckpoint } from "../hooks/useAddonCheckpoint";
import { useBatchHistory } from "../hooks/useBatchHistory";
import { useDebounce } from "../hooks/useDebounce";
import IPFSUpload from "../components/IPFSUpload";
import AuditTimeline from "../components/AuditTimeline";
import FlaggedBanner from "../components/FlaggedBanner";
import AnomalyBadge from "../components/AnomalyBadge";
import ErrorMessage from "../components/ErrorMessage";
import { ActionType, ACTION_LABELS, SELECTABLE_ACTIONS } from "../types";
import { txLink } from "../config/chains";
import { isValidBatchId } from "../lib/batchId";
import { useI18n } from "../i18n/I18nContext";

// Shared input className for terse markup
const INPUT_CLASS =
  "w-full px-3 py-2 text-sm border border-gray-300 rounded-md " +
  "focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none";

// LogCheckpoint: gated to LOGISTICS_ROLE or RETAILER_ROLE.
// Shows live timeline so user can verify what they're appending to.
export default function LogCheckpoint() {
  const { contract, isConnected } = useContract();
  const { address } = useWalletAccount();
  const { t } = useI18n();
  const role = useRole(contract, address);
  const { logCheckpoint, reset, loading, success, error, txHash, anomaly } =
    useCheckpoint(contract);

  // Search params allow QR scan / link to pre-fill the batchId
  const [searchParams] = useSearchParams();
  const urlBatchId = searchParams.get("batchId") || "";

  const { logAddon, reset: resetAddon, loading: addonLoading, success: addonSuccess,
    error: addonError, txHash: addonTxHash } = useAddonCheckpoint(contract);

  // Tab state
  const [tab, setTab] = useState<"main" | "addon">("main");

  // Form state
  const [batchId, setBatchId] = useState(urlBatchId);
  const [actionType, setActionType] = useState<ActionType>(ActionType.PROCESSED);
  const [location, setLocation] = useState("");
  const [file, setFile] = useState<File | null>(null);

  // Add-on form state
  const [addonLabel, setAddonLabel] = useState("");
  const [addonLocation, setAddonLocation] = useState("");
  const [addonFile, setAddonFile] = useState<File | null>(null);

  // Sync URL changes into local state
  useEffect(() => {
    if (urlBatchId && urlBatchId !== batchId) setBatchId(urlBatchId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlBatchId]);

  // Debounce so timeline doesn't fire an RPC call on every keystroke
  const debouncedBatchId = useDebounce(batchId, 600);
  const isValidId = isValidBatchId(debouncedBatchId);

  // Live history for the batch the user is targeting
  const history = useBatchHistory(contract, isValidId ? debouncedBatchId : undefined);

  // Refresh timeline after successful submit (either form)
  useEffect(() => {
    if (success) history.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [success]);

  useEffect(() => {
    if (addonSuccess) history.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addonSuccess]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchId || !location) return;
    logCheckpoint(batchId, actionType, location, file);
  };

  const onAddonSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchId || !addonLabel) return;
    logAddon(batchId, addonLabel, addonLocation, addonFile);
  };

  // === Access guards ===
  if (!isConnected) {
    return <GuardMessage title={t("register.walletRequired")} body={t("register.walletConnectMsg")} />;
  }
  if (role.loading) {
    return <GuardMessage title={t("register.checkingPerms")} body={t("register.verifyingRole")} />;
  }
  if (!role.isLogistics && !role.isRetailer) {
    return (
      <GuardMessage
        title={t("checkpoint.accessDenied")}
        body={t("checkpoint.accessDeniedMsg")}
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">
          {t("checkpoint.title")}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {t("checkpoint.subtitle")}
        </p>
      </header>

      {/* Flagged warning sits at top per spec; checkpoints still allowed */}
      {history.batch?.flagged && history.auditFlags.length > 0 && (
        <FlaggedBanner flag={history.auditFlags[history.auditFlags.length - 1]} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: tabbed form */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-5">
          {/* Tab switcher */}
          <div className="flex rounded-md border border-gray-200 overflow-hidden text-sm font-medium">
            <button
              type="button"
              onClick={() => setTab("main")}
              className={`flex-1 py-2 ${tab === "main" ? "bg-green-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
            >
              {t("checkpoint.mainTab")}
            </button>
            <button
              type="button"
              onClick={() => setTab("addon")}
              className={`flex-1 py-2 ${tab === "addon" ? "bg-green-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
            >
              {t("checkpoint.addonTab")}
            </button>
          </div>

          {/* Shared: Batch ID */}
          <Field label={t("checkpoint.batchId")} required>
            <input
              type="text"
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              placeholder="0x..."
              className={`${INPUT_CLASS} font-mono text-xs`}
            />
          </Field>

          {tab === "main" ? (
            <form onSubmit={onSubmit} className="space-y-5">
              <Field label={t("checkpoint.action")} required>
                <select
                  value={actionType}
                  onChange={(e) => setActionType(Number(e.target.value) as ActionType)}
                  className={INPUT_CLASS}
                >
                  {SELECTABLE_ACTIONS.map((a) => (
                    <option key={a} value={a}>{ACTION_LABELS[a]}</option>
                  ))}
                </select>
              </Field>

              <Field label={t("checkpoint.location")} required>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder={t("checkpoint.locationPlaceholder")}
                  required
                  className={INPUT_CLASS}
                />
              </Field>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t("checkpoint.evidence")} <span className="text-gray-400 font-normal">({t("common.optional")})</span>
                </label>
                <IPFSUpload onFileSelected={setFile} />
              </div>

              {anomaly && <AnomalyBadge attempted={anomaly.attempted} last={anomaly.last} />}

              {error && !anomaly && <ErrorMessage error={error} />}

              {success && txHash && (
                <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800 animate-fadeIn">
                  <p className="font-medium">{t("checkpoint.successTitle")}</p>
                  <a href={txLink(txHash)} target="_blank" rel="noopener noreferrer"
                    className="text-xs font-mono break-all hover:underline">
                    {txHash} ↗
                  </a>
                  <button type="button" onClick={reset}
                    className="block mt-2 text-xs text-green-700 hover:underline">
                    {t("checkpoint.logAnother")}
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !batchId || !location}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white px-4 py-2.5 rounded-md text-sm font-medium"
              >
                {loading ? t("common.submitting") : t("checkpoint.submit")}
              </button>
            </form>
          ) : (
            <form onSubmit={onAddonSubmit} className="space-y-5">
              <p className="text-xs text-gray-500">
                {t("checkpoint.addonHint")}
              </p>

              <Field label={t("checkpoint.addonProcessName")} required>
                <input
                  type="text"
                  value={addonLabel}
                  onChange={(e) => setAddonLabel(e.target.value)}
                  placeholder={t("checkpoint.addonPlaceholder")}
                  required
                  className={INPUT_CLASS}
                />
              </Field>

              <Field label={t("checkpoint.location")}>
                <input
                  type="text"
                  value={addonLocation}
                  onChange={(e) => setAddonLocation(e.target.value)}
                  placeholder={t("checkpoint.locationPlaceholder")}
                  className={INPUT_CLASS}
                />
              </Field>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t("checkpoint.evidence")} <span className="text-gray-400 font-normal">({t("common.optional")})</span>
                </label>
                <IPFSUpload onFileSelected={setAddonFile} />
              </div>

              {addonError && <ErrorMessage error={addonError} />}

              {addonSuccess && addonTxHash && (
                <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800 animate-fadeIn">
                  <p className="font-medium">{t("checkpoint.addonSuccess")}</p>
                  <a href={txLink(addonTxHash)} target="_blank" rel="noopener noreferrer"
                    className="text-xs font-mono break-all hover:underline">
                    {addonTxHash} ↗
                  </a>
                  <button type="button" onClick={resetAddon}
                    className="block mt-2 text-xs text-green-700 hover:underline">
                    {t("checkpoint.logAnother")}
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={addonLoading || !batchId || !addonLabel}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white px-4 py-2.5 rounded-md text-sm font-medium"
              >
                {addonLoading ? t("common.submitting") : t("checkpoint.addonSubmit")}
              </button>
            </form>
          )}
        </div>

        {/* Right: live timeline preview */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            {t("checkpoint.timelineTitle")}
            {history.batch && (
              <span className="ml-2 font-normal text-gray-500">
                · {history.batch.productName}
              </span>
            )}
          </h3>
          {!batchId && (
            <p className="text-sm text-gray-500">
              {t("checkpoint.enterBatchId")}
            </p>
          )}
          {batchId && !isValidId && (
            <p className="text-sm text-gray-400">
              {t("checkpoint.invalidId")}
            </p>
          )}
          {isValidId && history.loading && (
            <p className="text-sm text-gray-500">{t("common.loading")}</p>
          )}
          {isValidId && !history.loading && history.error && (
            <div>
              <p className="text-sm text-red-600">{t("checkpoint.notFound")}</p>
              <p className="text-xs text-red-400 mt-1 break-all">{history.error}</p>
            </div>
          )}
          {isValidId && !history.loading && history.checkpoints.length > 0 && (
            <AuditTimeline
              checkpoints={history.checkpoints}
              imageUrls={history.imageUrls.checkpointImages}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// Reusable field wrapper duplicated locally to avoid cross-page coupling
function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function GuardMessage({ title, body }: { title: string; body: string }) {
  return (
    <div className="max-w-md mx-auto text-center py-16">
      <h2 className="text-xl font-semibold text-gray-900 mb-2">{title}</h2>
      <p className="text-gray-600">{body}</p>
    </div>
  );
}
