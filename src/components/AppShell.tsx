"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LogoutButton } from "@/components/LogoutButton";

const MAIN_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/clients", label: "Clients" },
  { href: "/policies", label: "Policies" },
  { href: "/reminders", label: "Reminders" },
] as const;

const MORE_LINKS = [
  { href: "/import", label: "Import" },
  { href: "/settings/users", label: "Settings" },
] as const;

function NavLink({
  href,
  label,
  isActive,
}: {
  href: string;
  label: string;
  isActive: boolean;
}) {
  return (
    <Link
      href={href}
      className={`min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        isActive
          ? "bg-primary text-white"
          : "text-gray-700 hover:bg-gray-100 hover:text-primary"
      }`}
    >
      {label}
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    if (href === "/settings/users")
      return pathname.startsWith("/settings");
    return pathname.startsWith(href);
  };

  return (
    <div className="min-h-full flex flex-col">
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex h-14 items-center justify-between">
            <Link
              href="/dashboard"
              className="text-lg font-semibold text-primary shrink-0"
            >
              Graazo
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-1">
              {MAIN_LINKS.map(({ href, label }) => (
                <NavLink
                  key={href}
                  href={href}
                  label={label}
                  isActive={isActive(href)}
                />
              ))}
              {MORE_LINKS.map(({ href, label }) => (
                <NavLink
                  key={href}
                  href={href}
                  label={label}
                  isActive={isActive(href)}
                />
              ))}
              <div className="ml-2 pl-2 border-l border-gray-200">
                <LogoutButton />
              </div>
            </nav>

            {/* Mobile menu button */}
            <div className="flex md:hidden items-center gap-2">
              <LogoutButton />
              <button
                type="button"
                onClick={() => setMobileOpen((o) => !o)}
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100"
                aria-label={mobileOpen ? "Close menu" : "Open menu"}
                aria-expanded={mobileOpen}
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  {mobileOpen ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile nav drawer */}
        {mobileOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white">
            <nav className="px-4 py-3 flex flex-col gap-1">
              {MAIN_LINKS.map(({ href, label }) => (
                <NavLink
                  key={href}
                  href={href}
                  label={label}
                  isActive={isActive(href)}
                />
              ))}
              {MORE_LINKS.map(({ href, label }) => (
                <NavLink
                  key={href}
                  href={href}
                  label={label}
                  isActive={isActive(href)}
                />
              ))}
            </nav>
          </div>
        )}
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 md:py-8">
        {children}
      </main>
    </div>
  );
}
