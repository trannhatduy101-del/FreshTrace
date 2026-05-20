import { useRef } from "react";
import { QRCodeSVG } from "qrcode.react";

interface QRCodeDisplayProps {
  batchId: string;
  size?: number;
}

// QR code encoding the public trace URL for this batch.
// Renders as SVG and supports PNG download via canvas rasterization.
export default function QRCodeDisplay({ batchId, size = 200 }: QRCodeDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Build URL relative to the current origin so it works in any deployment
  const url = `${window.location.origin}/trace/${batchId}`;

  // Rasterize the inline SVG to PNG and trigger a download
  const downloadPng = () => {
    const svg = containerRef.current?.querySelector("svg");
    if (!svg) return;

    // Serialize SVG, draw to canvas, then export as PNG data URL
    const xml = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
    const svgUrl = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      // Render at 2x for crisp output
      canvas.width = size * 2;
      canvas.height = size * 2;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(svgUrl);

      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `freshtrace-${batchId.slice(0, 10)}.png`;
      a.click();
    };
    img.src = svgUrl;
  };

  return (
    <div className="text-center">
      <div
        ref={containerRef}
        className="inline-block p-4 bg-white rounded border border-gray-200"
      >
        <QRCodeSVG
          value={url}
          size={size}
          level="H"
          marginSize={1}
          fgColor="#059669"
        />
      </div>
      <p className="text-sm text-gray-600 mt-3">Scan to verify product origin</p>
      <p className="text-xs text-gray-400 mt-1 break-all font-mono">{url}</p>
      <button
        type="button"
        onClick={downloadPng}
        className="mt-3 text-xs text-green-700 hover:underline"
      >
        Download QR (PNG)
      </button>
    </div>
  );
}
