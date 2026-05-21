import { useContract } from "../hooks/useContract";
import { useRole } from "../hooks/useRole";
import { useWalletAccount } from "../hooks/useWallet";
import { useI18n } from "../i18n/I18nContext";

// Tiny coloured chips that show which on-chain roles the connected wallet
// has. Lets the demo audience see at a glance why a page is gated or not,
// and shows admins their elevated status.
export default function RoleBadges() {
  const { contract } = useContract();
  const { address, isConnected } = useWalletAccount();
  const role = useRole(contract, address);
  const { t } = useI18n();

  if (!isConnected || role.loading) return null;

  const badges: { label: string; cls: string }[] = [];
  if (role.isAdmin)     badges.push({ label: t("roles.admin"),     cls: "bg-purple-100 text-purple-800" });
  if (role.isProducer)  badges.push({ label: t("roles.producer"),  cls: "bg-green-100 text-green-800" });
  if (role.isLogistics) badges.push({ label: t("roles.logistics"), cls: "bg-blue-100 text-blue-800" });
  if (role.isRetailer)  badges.push({ label: t("roles.retailer"),  cls: "bg-orange-100 text-orange-800" });
  if (role.isAuditor)   badges.push({ label: t("roles.auditor"),   cls: "bg-red-100 text-red-800" });

  if (badges.length === 0) {
    return (
      <span className="text-xs px-2 py-0.5 rounded font-medium bg-gray-100 text-gray-500">
        {t("roles.none")}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {badges.map((b) => (
        <span key={b.label} className={`text-xs px-2 py-0.5 rounded font-medium ${b.cls}`}>
          {b.label}
        </span>
      ))}
    </div>
  );
}
