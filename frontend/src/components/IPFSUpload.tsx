import { useCallback, useState } from "react";
import { usePinata } from "../hooks/usePinata";

interface IPFSUploadProps {
  // Called once user selects a file (parent uploads on submit)
  onFileSelected?: (file: File | null) => void;
  // Called after the file is uploaded to Pinata, with the resulting CID
  onUpload?: (cid: string) => void;
  // Auto-upload immediately on file select instead of waiting for parent
  autoUpload?: boolean;
}

type UploadState = "idle" | "selected" | "uploading" | "done" | "error";

const MAX_BYTES = 10 * 1024 * 1024; // 10MB cap matches Pinata free-tier comfort

// Two-mode file input: parent-driven (return File) or auto-upload to Pinata.
// Validates size + type client-side before any network call.
export default function IPFSUpload({
  onFileSelected,
  onUpload,
  autoUpload = false,
}: IPFSUploadProps) {
  const { uploadFile, loading: pinataLoading } = usePinata();
  const [state, setState] = useState<UploadState>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [cid, setCid] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Centralized file handling for click and drop inputs
  const handleFile = useCallback(
    async (selected: File) => {
      // Type guard: accept images and PDFs only
      const isImage = selected.type.startsWith("image/");
      const isPdf = selected.type === "application/pdf";
      if (!isImage && !isPdf) {
        setState("error");
        setErrorMsg("Only images and PDFs are supported.");
        return;
      }
      if (selected.size > MAX_BYTES) {
        setState("error");
        setErrorMsg("File exceeds 10MB limit.");
        return;
      }

      setFile(selected);
      setErrorMsg(null);
      setCid(null);

      // Generate preview URL for images only (PDFs get a generic icon)
      if (isImage) {
        setPreview(URL.createObjectURL(selected));
      } else {
        setPreview(null);
      }

      setState("selected");
      onFileSelected?.(selected);

      // Auto-upload path: skip parent and call Pinata immediately
      if (autoUpload) {
        setState("uploading");
        try {
          const newCid = await uploadFile(selected);
          setCid(newCid);
          setState("done");
          onUpload?.(newCid);
        } catch (e) {
          setState("error");
          setErrorMsg(e instanceof Error ? e.message : "Upload failed");
        }
      }
    },
    [autoUpload, onFileSelected, onUpload, uploadFile]
  );

  // Reset everything; called by × button
  const clear = () => {
    setFile(null);
    setPreview(null);
    setCid(null);
    setErrorMsg(null);
    setState("idle");
    onFileSelected?.(null);
  };

  return (
    <div className="w-full">
      <label
        htmlFor="ipfs-file-input"
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) handleFile(f);
        }}
        className={`block w-full cursor-pointer rounded-md border-2 border-dashed p-4 text-center transition-colors ${
          dragOver
            ? "border-green-500 bg-green-50"
            : "border-gray-300 hover:border-gray-400 bg-gray-50"
        }`}
      >
        {state === "idle" && (
          <div className="py-6">
            <svg className="w-8 h-8 mx-auto text-gray-400 mb-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.9 5 5 0 119.9 1A5 5 0 0117 16h-1m-4-4v8m0-8l-3 3m3-3l3 3" />
            </svg>
            <p className="text-sm text-gray-600">
              Click or drag a file to upload
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Images or PDF · max 10MB
            </p>
          </div>
        )}

        {(state === "selected" || state === "uploading" || state === "done") && file && (
          <div className="flex items-center gap-3 text-left">
            {preview ? (
              <img
                src={preview}
                alt="preview"
                className="w-16 h-16 object-cover rounded border border-gray-200"
              />
            ) : (
              <div className="w-16 h-16 flex items-center justify-center bg-white rounded border border-gray-200">
                <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {file.name}
              </p>
              <p className="text-xs text-gray-500">
                {(file.size / 1024).toFixed(1)} KB
              </p>
              {state === "uploading" && (
                <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                  <Spinner /> Uploading to IPFS…
                </p>
              )}
              {state === "done" && cid && (
                <p className="text-xs text-green-700 mt-1 truncate">
                  ✓ ipfs://{cid.slice(0, 16)}…
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                clear();
              }}
              className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              aria-label="Remove file"
            >
              ×
            </button>
          </div>
        )}

        {state === "error" && (
          <div className="py-4">
            <p className="text-sm text-red-700">{errorMsg}</p>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                clear();
              }}
              className="text-xs text-gray-500 hover:underline mt-1"
            >
              Try again
            </button>
          </div>
        )}

        <input
          id="ipfs-file-input"
          type="file"
          className="hidden"
          accept="image/*,application/pdf"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
          disabled={pinataLoading}
        />
      </label>
    </div>
  );
}

// Small inline spinner for the uploading state
function Spinner() {
  return (
    <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
    </svg>
  );
}
