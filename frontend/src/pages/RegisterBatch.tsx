import { useState, useCallback } from "react";
import { useWalletAccount } from "../hooks/useWallet";
import { useContract } from "../hooks/useContract";
import { useRole } from "../hooks/useRole";
import { useBatchRegistry } from "../hooks/useBatchRegistry";
import IPFSUpload from "../components/IPFSUpload";
import QRCodeDisplay from "../components/QRCodeDisplay";
import { txLink } from "../config/chains";
import { QuantityUnit } from "../types";
import { useI18n } from "../i18n/I18nContext";

// Shared input className — referenced by every <input> in the form
const INPUT_CLASS =
  "w-full px-3 py-2 text-sm border border-gray-300 rounded-md " +
  "focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none";

// RegisterBatch page: gated to PRODUCER_ROLE wallets.
// On success, shows tx hash + QR code for the new batchId.
export default function RegisterBatch() {
  const { contract, isConnected } = useContract();
  const { address } = useWalletAccount();
  const role = useRole(contract, address);
  const { register, reset, loading, success, error, batchId, txHash } =
    useBatchRegistry(contract);

  const { t } = useI18n();

  // Local form state — kept simple, no form library needed for 5 fields
  const [productName, setProductName] = useState("");
  const [origin, setOrigin] = useState("");
  const [harvestDate, setHarvestDate] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState<QuantityUnit>(QuantityUnit.GRAMS);
  const [ocop, setOcop] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  // Convert date input (YYYY-MM-DD) to unix seconds; validate then submit
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ts = Math.floor(new Date(harvestDate).getTime() / 1000);
    const qty = parseInt(quantity, 10);
    if (!productName || !origin || !ts || !qty || isNaN(qty)) return;
    register(productName, origin, ts, qty, unit, ocop, file);
  };

  // Allow user to register another batch after success
  const startOver = () => {
    reset();
    setProductName("");
    setOrigin("");
    setHarvestDate("");
    setQuantity("");
    setUnit(QuantityUnit.GRAMS);
    setOcop(false);
    setFile(null);
  };

  // === Access guards ===
  if (!isConnected) {
    return <GuardMessage title={t("register.walletRequired")} body={t("register.walletConnectMsg")} />;
  }
  if (role.loading) {
    return <GuardMessage title={t("register.checkingPerms")} body={t("register.verifyingRole")} />;
  }
  if (!role.isProducer) {
    return <GuardMessage title={t("register.producerOnly")} body={t("register.producerOnlyMsg")} />;
  }

  // === Success view ===
  if (success && batchId) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-fadeIn">
        <div className="rounded-lg bg-green-50 border border-green-200 p-6 text-center">
          <svg className="w-12 h-12 mx-auto text-green-600 mb-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-xl font-semibold text-green-900">{t("register.successTitle")}</h2>
          <p className="text-sm text-green-800 mt-1">
            {t("register.successBody")}
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">{t("register.batchId")}</p>
            <div className="flex items-start gap-2">
              <p className="font-mono text-xs text-gray-900 break-all flex-1">{batchId}</p>
              <CopyButton text={batchId} />
            </div>
          </div>
          {txHash && (
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">{t("register.transaction")}</p>
              <a
                href={txLink(txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-green-700 hover:underline break-all"
              >
                {txHash} ↗
              </a>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <QRCodeDisplay batchId={batchId} />
        </div>

        <div className="flex gap-3">
          <button
            onClick={startOver}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium"
          >
            {t("register.registerAnother")}
          </button>
        </div>
      </div>
    );
  }

  // === Form view ===
  return (
    <div className="max-w-2xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">
          {t("register.title")}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {t("register.subtitle")}
        </p>
      </header>

      <form onSubmit={onSubmit} className="space-y-5 bg-white rounded-lg border border-gray-200 p-6">
        <Field label={t("register.productName")} required>
          <input
            type="text"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder={t("register.productPlaceholder")}
            maxLength={100}
            required
            className={INPUT_CLASS}
          />
        </Field>

        <Field label={t("register.origin")} required>
          <input
            type="text"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            placeholder={t("register.originPlaceholder")}
            maxLength={100}
            required
            className={INPUT_CLASS}
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Field label={t("register.harvestDate")} required>
            <input
              type="date"
              value={harvestDate}
              onChange={(e) => setHarvestDate(e.target.value)}
              required
              className={INPUT_CLASS}
            />
          </Field>

          <Field label={t("register.quantity")} required>
            <div className="flex gap-2">
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder={t("register.quantityPlaceholder")}
                required
                className={INPUT_CLASS}
              />
              <select
                value={unit}
                onChange={(e) => setUnit(Number(e.target.value) as QuantityUnit)}
                className="px-2 py-2 text-sm border border-gray-300 rounded-md focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none bg-white"
                aria-label={t("register.unit")}
              >
                <option value={QuantityUnit.GRAMS}>{t("register.grams")}</option>
                <option value={QuantityUnit.KILOGRAMS}>{t("register.kilograms")}</option>
              </select>
            </div>
          </Field>
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={ocop}
            onChange={(e) => setOcop(e.target.checked)}
            className="w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-500"
          />
          <span className="text-sm text-gray-700">{t("register.ocopLabel")}</span>
        </label>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t("register.photo")} <span className="text-gray-400 font-normal">({t("common.optional")})</span>
          </label>
          <IPFSUpload onFileSelected={setFile} />
        </div>

        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-md text-sm font-medium transition-colors"
        >
          {loading ? t("register.registering") : t("register.submit")}
        </button>
      </form>

    </div>
  );
}

// Reusable form field wrapper
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

// Access-denied / informational gate
function GuardMessage({ title, body }: { title: string; body: string }) {
  return (
    <div className="max-w-md mx-auto text-center py-16">
      <h2 className="text-xl font-semibold text-gray-900 mb-2">{title}</h2>
      <p className="text-gray-600">{body}</p>
    </div>
  );
}

function CopyButton({ text }: { text: string | null }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable — fail silently
    }
  }, [text]);

  return (
    <button
      type="button"
      onClick={copy}
      className="shrink-0 text-xs px-2 py-1 rounded border border-gray-200 text-gray-500 hover:text-green-700 hover:border-green-300 transition-colors"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}
