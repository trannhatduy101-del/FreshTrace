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
import { ActionType, ACTION_LABELS, SELECTABLE_ACTIONS } from "../types";
import { txLink } from "../config/chains";
import { isValidBatchId } from "../lib/batchId";

// Shared input className for terse markup
const INPUT_CLASS =
  "w-full px-3 py-2 text-sm border border-gray-300 rounded-md " +
  "focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none";

// LogCheckpoint: gated to LOGISTICS_ROLE or RETAILER_ROLE.
// Shows live timeline so user can verify what they're appending to.
export default function LogCheckpoint() {
  const { contract, isConnected } = useContract();
  const { address } = useWalletAccount();
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
    return <GuardMessage title="Wallet required" body="Connect your wallet to log a checkpoint." />;
  }
  if (role.loading) {
    return <GuardMessage title="Checking permissions…" body="Verifying your role on the contract." />;
  }
  if (!role.isLogistics && !role.isRetailer) {
    return (
      <GuardMessage
        title="Access denied"
        body="Only Logistics and Retailer roles can log checkpoints. Connect an authorized wallet."
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">
          Log Checkpoint
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Append a new event to a batch's supply chain history.
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
              Main Checkpoint
            </button>
            <button
              type="button"
              onClick={() => setTab("addon")}
              className={`flex-1 py-2 ${tab === "addon" ? "bg-green-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
            >
              Add-on Process
            </button>
          </div>

          {/* Shared: Batch ID */}
          <Field label="Batch ID" required>
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
              <Field label="Action" required>
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

              <Field label="Location" required>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Binh Dien Market, HCMC"
                  required
                  className={INPUT_CLASS}
                />
              </Field>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Evidence Photo <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <IPFSUpload onFileSelected={setFile} />
              </div>

              {anomaly && <AnomalyBadge attempted={anomaly.attempted} last={anomaly.last} />}

              {error && !anomaly && (
                <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
                  {error}
                </div>
              )}

              {success && txHash && (
                <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800 animate-fadeIn">
                  <p className="font-medium">Checkpoint logged.</p>
                  <a href={txLink(txHash)} target="_blank" rel="noopener noreferrer"
                    className="text-xs font-mono break-all hover:underline">
                    {txHash} ↗
                  </a>
                  <button type="button" onClick={reset}
                    className="block mt-2 text-xs text-green-700 hover:underline">
                    Log another →
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !batchId || !location}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white px-4 py-2.5 rounded-md text-sm font-medium"
              >
                {loading ? "Submitting…" : "Log Checkpoint"}
              </button>
            </form>
          ) : (
            <form onSubmit={onAddonSubmit} className="space-y-5">
              <p className="text-xs text-gray-500">
                Add a custom process step (e.g. Quality Check, Cold Storage) without affecting the main supply-chain flow order.
              </p>

              <Field label="Process Name" required>
                <input
                  type="text"
                  value={addonLabel}
                  onChange={(e) => setAddonLabel(e.target.value)}
                  placeholder="e.g. Quality Check, Cold Storage Entry"
                  required
                  className={INPUT_CLASS}
                />
              </Field>

              <Field label="Location">
                <input
                  type="text"
                  value={addonLocation}
                  onChange={(e) => setAddonLocation(e.target.value)}
                  placeholder="e.g. Warehouse A, HCMC"
                  className={INPUT_CLASS}
                />
              </Field>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Evidence Photo <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <IPFSUpload onFileSelected={setAddonFile} />
              </div>

              {addonError && (
                <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
                  {addonError}
                </div>
              )}

              {addonSuccess && addonTxHash && (
                <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800 animate-fadeIn">
                  <p className="font-medium">Add-on process logged.</p>
                  <a href={txLink(addonTxHash)} target="_blank" rel="noopener noreferrer"
                    className="text-xs font-mono break-all hover:underline">
                    {addonTxHash} ↗
                  </a>
                  <button type="button" onClick={resetAddon}
                    className="block mt-2 text-xs text-green-700 hover:underline">
                    Log another →
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={addonLoading || !batchId || !addonLabel}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white px-4 py-2.5 rounded-md text-sm font-medium"
              >
                {addonLoading ? "Submitting…" : "Log Add-on Process"}
              </button>
            </form>
          )}
        </div>

        {/* Right: live timeline preview */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            Current Timeline
            {history.batch && (
              <span className="ml-2 font-normal text-gray-500">
                · {history.batch.productName}
              </span>
            )}
          </h3>
          {!batchId && (
            <p className="text-sm text-gray-500">
              Enter a Batch ID to preview its current checkpoints.
            </p>
          )}
          {batchId && !isValidId && (
            <p className="text-sm text-gray-400">
              Paste the full Batch ID (66 characters starting with 0x).
            </p>
          )}
          {isValidId && history.loading && (
            <p className="text-sm text-gray-500">Loading…</p>
          )}
          {isValidId && !history.loading && history.error && (
            <div>
              <p className="text-sm text-red-600">Failed to load batch.</p>
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
