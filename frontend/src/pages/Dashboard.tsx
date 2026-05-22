import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useWalletAccount } from "../hooks/useWallet";
import { useContract } from "../hooks/useContract";
import { ipfsUrl } from "../config/pinata";
import { ActionType, Batch, QuantityUnit } from "../types";
import { useI18n } from "../i18n/I18nContext";

// Combined card data: batch + its derived status flags
interface BatchCard {
  id: string;
  batch: Batch;
  checkpointCount: number;
}

const PAGE_SIZE = 12;

// Dashboard: scans all registered batches and renders a responsive card grid.
export default function Dashboard() {
  const { contract, isConnected } = useContract();
  const { address } = useWalletAccount();
  const { t } = useI18n();
  const [cards, setCards] = useState<BatchCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!contract) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        // Pull all batch IDs, then fan out parallel getHistory calls
        const ids: string[] = await contract.getBatchIds();
        const histories = await Promise.all(
          ids.map((id) => contract.getHistory(id))
        );

        const built: BatchCard[] = ids.map((id, i) => {
          const [rawBatch, rawCheckpoints] = histories[i];
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
            checkpointCount: rawCheckpoints.length,
          };
        });

        if (!cancelled) setCards(built);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load batches");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [contract, address]);

  // Client-side filter + pagination (no extra RPC calls)
  const filtered = cards.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.batch.productName.toLowerCase().includes(q) ||
      c.batch.origin.toLowerCase().includes(q)
    );
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  // Clamp the current page so a shrinking list (e.g. after a new search)
  // never leaves the user on an empty page.
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Reset to page 1 when search changes
  const handleSearch = (q: string) => { setSearch(q); setPage(1); };

  // Gate the page on wallet connection. The dashboard is for connected roles only.
  if (!isConnected) {
    return (
      <div className="text-center py-16">
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          {t("dashboard.connectFirst")}
        </h2>
        <p className="text-gray-600 max-w-md mx-auto">
          {t("dashboard.connectBody")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">
            {t("dashboard.title")}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {loading
              ? t("dashboard.loadingBatches")
              : `${cards.length} ${cards.length === 1 ? t("dashboard.batchCount") : t("dashboard.batchesCount")}`}
          </p>
        </div>
        <Link
          to="/register"
          className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
        >
          {t("dashboard.registerBtn")}
        </Link>
      </header>

      {/* Search bar */}
      {!loading && cards.length > 0 && (
        <div className="flex gap-2 max-w-md">
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder={t("dashboard.searchPlaceholder")}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => handleSearch("")}
              className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded-md"
            >
              {t("common.clear")}
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Loading skeleton grid mirrors final card shape to avoid layout shift */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 animate-pulse"
            >
              <div className="aspect-video bg-gray-100 rounded mb-3" />
              <div className="h-4 bg-gray-100 rounded w-2/3 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {!loading && cards.length === 0 && !error && (
        <div className="text-center py-16 bg-white rounded-lg border border-dashed border-gray-300">
          <p className="text-gray-600">
            {t("dashboard.noBatches")}
          </p>
        </div>
      )}

      {!loading && cards.length > 0 && filtered.length === 0 && (
        <div className="text-center py-12 text-gray-500 text-sm">
          {t("dashboard.noMatch")} "{search}".
        </div>
      )}

      {!loading && paginated.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginated.map(({ id, batch, checkpointCount }) => (
              <BatchCardItem
                key={id}
                id={id}
                batch={batch}
                checkpointCount={checkpointCount}
              />
            ))}
          </div>

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-md disabled:opacity-40 hover:bg-gray-50"
              >
                ← {t("common.prev")}
              </button>
              <span className="text-sm text-gray-600">
                {t("common.page")} {safePage} {t("common.of")} {totalPages}
                {search ? ` (${filtered.length} ${t("dashboard.results")})` : ""}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-md disabled:opacity-40 hover:bg-gray-50"
              >
                {t("common.next")} →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Single card component, extracted for readability and stable React keys.
function BatchCardItem({
  id,
  batch,
  checkpointCount,
}: {
  id: string;
  batch: Batch;
  checkpointCount: number;
}) {
  const { t } = useI18n();
  // Convert bigint timestamp to friendly date string
  const harvestStr = new Date(Number(batch.harvestDate) * 1000).toLocaleDateString(
    undefined,
    { year: "numeric", month: "short", day: "numeric" }
  );

  return (
    <Link
      to={`/trace/${id}`}
      className="group bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden hover:shadow-md hover:border-green-200 transition-all"
    >
      {/* Image preview or placeholder gradient */}
      <div className="aspect-video bg-gradient-to-br from-green-50 to-emerald-100 overflow-hidden">
        {batch.ipfsHash ? (
          <img
            src={ipfsUrl(batch.ipfsHash)}
            alt={batch.productName}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-green-600">
            <svg className="w-12 h-12 opacity-40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19.2 2.96a1 1 0 0 1 1.8.66c0 1.2-.07 4.91-.6 7.2A7.3 7.3 0 0 1 13 16" />
            </svg>
          </div>
        )}
      </div>

      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-gray-900 truncate">
            {batch.productName}
          </h3>
          {/* Status badge. Flagged takes precedence over Active. */}
          {batch.flagged ? (
            <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
              {t("dashboard.flagged")}
            </span>
          ) : (
            <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
              {t("dashboard.active")}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-600 truncate">{batch.origin}</p>
        <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
          <span>{harvestStr}</span>
          <span>
            {checkpointCount} {checkpointCount === 1 ? t("dashboard.event") : t("dashboard.events")}
          </span>
        </div>
        {batch.ocop && (
          <div className="pt-1">
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              {t("dashboard.ocopCertified")}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
