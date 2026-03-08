"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  DashboardCircleIcon,
  UserGroup02Icon,
  MoneySafeIcon,
  Calendar02Icon,
  MoreHorizontalSquare02Icon,
} from "hugeicons-react";
import { useAuth } from "@/hooks/useAuth";
import { UserRole } from "@/lib/enum";
import { cn } from "@/lib/utils";

interface NavTab {
  icon: React.ElementType;
  label: string;
  href: string;
}

const ADMIN_TABS: NavTab[] = [
  { icon: DashboardCircleIcon, label: "Dashboard", href: "/" },
  { icon: UserGroup02Icon, label: "Members", href: "/business-management/customer" },
  { icon: MoneySafeIcon, label: "Loans", href: "/business-management/loan" },
  { icon: Calendar02Icon, label: "Schedules", href: "/business-management/loan-payment/repayment-schedules" },
];

const CREDIT_OFFICER_TABS: NavTab[] = [
  { icon: DashboardCircleIcon, label: "Dashboard", href: "/" },
  { icon: UserGroup02Icon, label: "Members", href: "/business-management/customer" },
  { icon: MoneySafeIcon, label: "Loans", href: "/business-management/loan" },
  { icon: Calendar02Icon, label: "Schedules", href: "/business-management/loan-payment/repayment-schedules" },
];

const SUPERVISOR_TABS: NavTab[] = ADMIN_TABS;

export function MobileBottomNav({ onMoreClick }: { onMoreClick?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();

  const role = user?.role;
  const tabs: NavTab[] =
    role === UserRole.ADMIN ? ADMIN_TABS
    : role === UserRole.SUPERVISOR ? SUPERVISOR_TABS
    : CREDIT_OFFICER_TABS;

  const isActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname.startsWith(href);

  // Use longest-match to avoid ambiguity (e.g. /loan vs /loan-payment/...)
  const activeIndex = (() => {
    let bestIdx = -1;
    let bestLen = 0;
    tabs.forEach((tab, i) => {
      if (isActive(tab.href) && tab.href.length > bestLen) {
        bestIdx = i;
        bestLen = tab.href.length;
      }
    });
    return bestIdx;
  })();

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 flex justify-center pb-4 px-3 pointer-events-none" data-tour-id="mobile-bottom-nav">
      <nav
        className={cn(
          "pointer-events-auto w-[90%] max-w-lg flex items-center justify-between px-3 py-2 rounded-full",
          "bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl",
          "border border-slate-200/60 dark:border-slate-700/60",
          "shadow-lg shadow-black/10 dark:shadow-black/30"
        )}
      >
        {tabs.map((tab, index) => {
          const active = index === activeIndex;
          const Icon = tab.icon;

          return (
            <button
              key={tab.href}
              onClick={() => router.push(tab.href)}
              className={cn(
                "relative flex items-center gap-2 rounded-full px-3 py-2.5 transition-all duration-300",
                active
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
              )}
              aria-label={tab.label}
            >
              {active && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 rounded-full bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200/50 dark:border-emerald-700/50"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <span className="relative z-10">
                <Icon size={20} className={cn(active ? "text-emerald-600 dark:text-emerald-400" : "")} />
              </span>
              {active && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  className="relative z-10 text-xs font-semibold whitespace-nowrap"
                >
                  {tab.label}
                </motion.span>
              )}
            </button>
          );
        })}

        {/* More button — opens sidebar */}
        <button
          onClick={onMoreClick}
          className="relative flex items-center rounded-full px-3 py-2.5 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          aria-label="More options"
        >
          <MoreHorizontalSquare02Icon size={20} />
        </button>
      </nav>
    </div>
  );
}
