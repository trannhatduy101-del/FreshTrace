import { useState, useCallback } from "react";
import { useI18n } from "../i18n/I18nContext";

interface ShareButtonProps {
  url: string;
  /** Title used by native Web Share API on mobile. */
  title?: string;
}

// Native share on mobile (iOS/Android Web Share API), fallback to copy on desktop.
export default function ShareButton({ url, title }: ShareButtonProps) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const onClick = useCallback(async () => {
    const shareTitle = title ?? t("trace.shareTitle");
    // Prefer the OS share sheet on mobile, much nicer than copy-then-paste.
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: shareTitle, url });
        return;
      } catch {
        // User cancelled the sheet, fall through to the clipboard fallback.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Final fallback: select the URL via a hidden textarea (older browsers).
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
      ta.remove();
    }
  }, [url, title, t]);

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
      </svg>
      {copied ? t("trace.shareCopied") : t("trace.shareBtn")}
    </button>
  );
}
