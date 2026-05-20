import { ReactNode, useState } from "react";
import { NavLink, Link } from "react-router-dom";
import WalletConnect from "./WalletConnect";

// Nav links rendered in both desktop and mobile menus
const NAV_LINKS = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/register", label: "Register Batch" },
  { to: "/checkpoint", label: "Log Checkpoint" },
  { to: "/audit", label: "Audit" },
  { to: "/trace", label: "Public Trace" },
];

interface LayoutProps {
  children: ReactNode;
}

// Top-level shell: sticky nav, mobile hamburger, main slot, footer
export default function Layout({ children }: LayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  // Shared className builder for active vs inactive nav links
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
      isActive
        ? "bg-green-50 text-green-700"
        : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
    }`;

  return (
    <div className="min-h-full flex flex-col bg-gray-50">
      {/* Sticky header keeps nav accessible during long scrolls */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Brand mark — leaf icon + wordmark, links home */}
            <Link to="/" className="flex items-center gap-2 group">
              <svg
                className="w-7 h-7 text-green-600 group-hover:scale-110 transition-transform"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19.2 2.96a1 1 0 0 1 1.8.66c0 1.2-.07 4.91-.6 7.2A7.3 7.3 0 0 1 13 16" />
                <path d="M2 21c0-3 1.85-5.36 5.08-6" />
              </svg>
              <span className="text-lg font-semibold text-gray-900 tracking-tight">
                FreshTrace
              </span>
            </Link>

            {/* Desktop nav — hidden below md */}
            <nav className="hidden md:flex items-center gap-1">
              {NAV_LINKS.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  className={linkClass}
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>

            {/* Wallet button (desktop) + hamburger (mobile) */}
            <div className="flex items-center gap-2">
              <div className="hidden md:block">
                <WalletConnect />
              </div>
              <button
                type="button"
                className="md:hidden p-2 rounded-md text-gray-600 hover:bg-gray-100"
                onClick={() => setMobileOpen((v) => !v)}
                aria-label="Toggle menu"
              >
                {mobileOpen ? (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Mobile drawer — collapses on link tap to feel native */}
          {mobileOpen && (
            <div className="md:hidden pb-3 border-t border-gray-100 animate-fadeIn">
              <nav className="flex flex-col gap-1 pt-3">
                {NAV_LINKS.map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    end={link.end}
                    className={linkClass}
                    onClick={() => setMobileOpen(false)}
                  >
                    {link.label}
                  </NavLink>
                ))}
                <div className="mt-2 px-3">
                  <WalletConnect />
                </div>
              </nav>
            </div>
          )}
        </div>
      </header>

      {/* Main content area with consistent horizontal padding */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {children}
      </main>

      {/* Footer — credits Group 7 per project brief */}
      <footer className="border-t border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 text-center text-xs text-gray-500">
          FreshTrace — INTE264 Blockchain Technology Fundamentals, Group 7 · RMIT
        </div>
      </footer>
    </div>
  );
}
