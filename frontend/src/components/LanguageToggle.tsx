import { useI18n } from "../i18n/I18nContext";

// Single-pill toggle showing both languages so users see the alternative
// at a glance. Clicking the inactive side switches the locale.
export default function LanguageToggle() {
  const { locale, setLocale } = useI18n();

  return (
    <div className="inline-flex items-center text-xs font-medium border border-gray-200 rounded-md overflow-hidden">
      <button
        type="button"
        onClick={() => setLocale("en")}
        className={`px-2.5 py-1 transition-colors ${
          locale === "en"
            ? "bg-green-600 text-white"
            : "text-gray-600 hover:bg-gray-50"
        }`}
        aria-label="English"
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLocale("vi")}
        className={`px-2.5 py-1 transition-colors ${
          locale === "vi"
            ? "bg-green-600 text-white"
            : "text-gray-600 hover:bg-gray-50"
        }`}
        aria-label="Tiếng Việt"
      >
        VI
      </button>
    </div>
  );
}
