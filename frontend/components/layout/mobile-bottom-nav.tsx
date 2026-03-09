"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Building2,
  Bot,
  Search,
  MoreHorizontal,
} from "lucide-react";

interface BottomNavProps {
  onOpenSidebar: () => void;
  /** Slot for an extra button (e.g. filter toggle on properties page) */
  extraButton?: React.ReactNode;
}

const NAV_ITEMS = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Properties", href: "/properties", icon: Building2 },
  { label: "Scrape", href: "/scraper", icon: Bot },
  { label: "Search", href: "/search", icon: Search },
];

export function MobileBottomNav({ onOpenSidebar, extraButton }: BottomNavProps) {
  const pathname = usePathname();

  return (
    <nav
      className="md:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center justify-between w-[90%] px-2 py-2 rounded-full shadow-lg backdrop-blur-md"
      style={{
        backgroundColor: "color-mix(in srgb, var(--card) 85%, transparent)",
        border: "1px solid var(--border)",
      }}
    >
      {NAV_ITEMS.map((item) => {
        const isActive =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-2 rounded-full px-3 py-2.5 transition-all"
            style={{
              backgroundColor: isActive ? "var(--card)" : "transparent",
              color: isActive ? "var(--primary)" : "var(--muted-foreground)",
              boxShadow: isActive ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
            }}
          >
            <Icon size={20} strokeWidth={isActive ? 2.2 : 1.5} />
            {isActive && (
              <span className="text-xs font-semibold whitespace-nowrap">
                {item.label}
              </span>
            )}
          </Link>
        );
      })}

      {/* Extra button slot (e.g. filter toggle on properties page) */}
      {extraButton && (
        <div className="flex items-center justify-center border-l pl-2 mr-1" style={{ borderColor: 'var(--border)' }}>
          {extraButton}
        </div>
      )}

      {/* More button — opens sidebar */}
      <button
        onClick={onOpenSidebar}
        className="flex items-center justify-center rounded-full px-3 py-2.5 transition-colors"
        style={{ color: "var(--muted-foreground)" }}
      >
        <MoreHorizontal size={20} strokeWidth={1.5} />
      </button>
    </nav>
  );
}
