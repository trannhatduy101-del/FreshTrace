import { useState } from "react";
import {
  Checkpoint,
  ACTION_LABELS,
  ACTION_COLORS,
  ActionType,
} from "../types";
import { addressLink } from "../config/chains";
import ResilientImage from "./ResilientImage";

interface AuditTimelineProps {
  checkpoints: Checkpoint[];
  /** Kept for backward compatibility; ResilientImage now derives URLs
   *  from the checkpoint's ipfsHash directly so it can fall back across
   *  gateways. The prop is unused but stays for any caller that still
   *  passes it. */
  imageUrls?: (string | null)[];
}

// Vertical timeline rendered top-to-bottom in chronological order (oldest first).
// First node (HARVESTED) gets a "Registered by Producer" subtitle.
export default function AuditTimeline({
  checkpoints,
}: AuditTimelineProps) {
  // Lightbox holds the CID of the checkpoint whose image is enlarged,
  // not a URL, so the modal also benefits from gateway fallback.
  const [lightboxCid, setLightboxCid] = useState<string | null>(null);

  if (checkpoints.length === 0) {
    return (
      <p className="text-sm text-gray-500">No checkpoints recorded yet.</p>
    );
  }

  return (
    <div className="relative">
      {/* Vertical connecting line behind the dots */}
      <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-gray-200" />

      <ol className="space-y-6">
        {checkpoints.map((cp, i) => (
          <li key={i} className="relative pl-10">
            {cp.addonLabel ? (
              /* Add-on checkpoint: dashed border, gray dot. */
              <>
                <span className="absolute left-0 top-1 w-6 h-6 rounded-full bg-gray-400 ring-4 ring-white flex items-center justify-center text-white text-xs">
                  +
                </span>
                <div className="bg-white rounded-md p-3 border border-dashed border-gray-300">
                  <div className="flex items-baseline justify-between gap-2 flex-wrap">
                    <h4 className="font-semibold text-gray-700 text-sm flex items-center gap-1.5">
                      <span className="text-xs font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">Add-on</span>
                      {cp.addonLabel}
                    </h4>
                    <time className="text-xs text-gray-500">{formatTimestamp(cp.timestamp)}</time>
                  </div>
                  {cp.location && <p className="text-sm text-gray-600 mt-1">📍 {cp.location}</p>}
                  <div className="mt-2 text-xs text-gray-400">
                    by{" "}
                    <a href={addressLink(cp.actor)} target="_blank" rel="noopener noreferrer"
                      className="font-mono hover:text-green-700">
                      {cp.actor.slice(0, 6)}…{cp.actor.slice(-4)}
                    </a>
                  </div>
                </div>
              </>
            ) : (
              /* Main-flow checkpoint with a coloured dot. */
              <>
                <span
                  className={`absolute left-0 top-1 w-6 h-6 rounded-full ${ACTION_COLORS[cp.action]} ring-4 ring-white flex items-center justify-center text-white text-xs font-bold`}
                >
                  {i + 1}
                </span>
                <div className="bg-gray-50 rounded-md p-3 border border-gray-100">
                  <div className="flex items-baseline justify-between gap-2 flex-wrap">
                    <h4 className="font-semibold text-gray-900 text-sm">
                      {ACTION_LABELS[cp.action]}
                      {i === 0 && cp.action === ActionType.HARVESTED && (
                        <span className="ml-2 font-normal text-xs text-gray-500">
                          — Origin · Registered by Producer
                        </span>
                      )}
                    </h4>
                    <time className="text-xs text-gray-500">{formatTimestamp(cp.timestamp)}</time>
                  </div>
                  <p className="text-sm text-gray-700 mt-1">📍 {cp.location}</p>
                  <div className="mt-2 text-xs text-gray-500">
                    by{" "}
                    <a href={addressLink(cp.actor)} target="_blank" rel="noopener noreferrer"
                      className="font-mono text-gray-600 hover:text-green-700">
                      {cp.actor.slice(0, 6)}…{cp.actor.slice(-4)}
                    </a>
                  </div>

              {cp.ipfsHash && (
                <button type="button" onClick={() => setLightboxCid(cp.ipfsHash)} className="mt-3 block">
                  <ResilientImage cid={cp.ipfsHash} alt="Evidence"
                    className="h-20 w-20 object-cover rounded border border-gray-200 hover:opacity-90 transition-opacity"
                    loading="lazy" />
                </button>
              )}
            </div>
              </>
            )}
          </li>
        ))}
      </ol>

      {/* Modal lightbox. Click backdrop or X to close. */}
      {lightboxCid && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setLightboxCid(null)}
        >
          <ResilientImage
            cid={lightboxCid}
            alt="Enlarged evidence"
            className="max-w-full max-h-full object-contain rounded"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            className="absolute top-4 right-4 text-white text-3xl leading-none"
            onClick={() => setLightboxCid(null)}
            aria-label="Close"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

// Format unix-second bigint into a readable local string
function formatTimestamp(ts: bigint): string {
  return new Date(Number(ts) * 1000).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
