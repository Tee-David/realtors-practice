"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { ThemeSwitch } from "@/components/ui/theme-switch";
import { motion, useAnimation, PanInfo, useMotionValue, useTransform } from "motion/react";
import {
  LayoutDashboard,
  Building2,
  Search,
  Database,
  Bot,
  Globe,
  Bookmark,
  BarChart3,
  TrendingUp,
  Settings,
  ScrollText,
  Menu,
  X,
  LogOut,
  ChevronDown,
  MessageSquareText,
  Sparkles,
  GitCompareArrows,
  Bell,
  Map,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

interface NavSection {
  label: string;
  icon: React.ElementType;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    label: "OVERVIEW",
    icon: LayoutDashboard,
    items: [
      { label: "Dashboard", href: "/", icon: LayoutDashboard },
      { label: "Properties", href: "/properties", icon: Building2 },
      { label: "Compare", href: "/properties/compare", icon: GitCompareArrows },
    ],
  },
  {
    label: "SEARCH & DISCOVER",
    icon: Search,
    items: [
      { label: "Search", href: "/search", icon: Search },
      { label: "Map Explorer", href: "/search?view=map", icon: Map },
      { label: "Saved Searches", href: "/saved-searches", icon: Bookmark },
    ],
  },
  {
    label: "DATA & SCRAPING",
    icon: Database,
    items: [
      { label: "Scraper", href: "/scraper", icon: Bot },
      { label: "Sites", href: "/scraper/sites", icon: Globe },
      { label: "Data Explorer", href: "/data-explorer", icon: Database },
    ],
  },
  {
    label: "INTELLIGENCE",
    icon: BarChart3,
    items: [
      { label: "Analytics", href: "/analytics", icon: BarChart3 },
      { label: "Market Intel", href: "/market", icon: TrendingUp },
      { label: "AI Assistant", href: "/ai", icon: Sparkles },
    ],
  },
  {
    label: "SYSTEM",
    icon: Settings,
    items: [
      { label: "Notifications", href: "/notifications", icon: Bell },
      { label: "Audit Log", href: "/audit-log", icon: ScrollText },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

function UserAvatar({ expanded }: { expanded: boolean }) {
  const initials = "AD";
  const name = "Admin";

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg",
        !expanded && "justify-center px-0"
      )}
    >
      <div
        className="flex items-center justify-center shrink-0 rounded-full font-semibold text-xs select-none"
        style={{
          width: 32,
          height: 32,
          backgroundColor: "var(--primary)",
          color: "var(--primary-foreground)",
        }}
      >
        {initials}
      </div>
      {expanded && (
        <span
          className="text-sm font-medium truncate"
          style={{ color: "var(--sidebar-foreground)" }}
        >
          {name}
        </span>
      )}
    </div>
  );
}

/** Hrefs that should only match exactly (not prefix-match child routes) */
const EXACT_MATCH_HREFS = new Set(["/", "/properties", "/scraper", "/search"]);

function isItemActive(href: string, pathname: string): boolean {
  if (href.includes("?")) {
    // Query-based routes (e.g. /search?view=map) — match base path only
    return pathname === href.split("?")[0];
  }
  if (EXACT_MATCH_HREFS.has(href)) {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(href + "/");
}

/** Check if any item in a section is currently active */
function sectionHasActiveItem(section: NavSection, pathname: string): boolean {
  return section.items.some((item) => isItemActive(item.href, pathname));
}

function CollapsibleSection({
  section,
  expanded,
  isOpen,
  onToggle,
  onNavClick,
  pathname,
}: {
  section: NavSection;
  expanded: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onNavClick?: () => void;
  pathname: string;
}) {
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = React.useState<number>(0);
  const hasActive = sectionHasActiveItem(section, pathname);
  const SectionIcon = section.icon;

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [isOpen, expanded]);

  // Collapsed sidebar: show only section icon
  if (!expanded) {
    const firstActiveItem = section.items.find((item) => isItemActive(item.href, pathname));
    const ActiveIcon = firstActiveItem ? firstActiveItem.icon : SectionIcon;

    return (
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "flex items-center justify-center rounded-lg px-0 py-2 transition-colors",
            hasActive ? "font-medium" : "hover:bg-[var(--sidebar-accent)]"
          )}
          style={{
            backgroundColor: hasActive ? "var(--sidebar-accent)" : undefined,
            color: hasActive
              ? "var(--sidebar-accent-foreground)"
              : "var(--sidebar-foreground)",
            width: 40,
          }}
          title={section.label}
        >
          <ActiveIcon className="h-4 w-4 shrink-0" />
        </div>
      </div>
    );
  }

  // Expanded sidebar: collapsible group
  return (
    <div>
      {/* Section header — clickable to toggle */}
      <button
        onClick={onToggle}
        className="flex items-center w-full px-3 py-1 group cursor-pointer"
      >
        <span
          className="text-[10px] font-semibold uppercase tracking-wider flex-1 text-left"
          style={{ color: "var(--muted-foreground)" }}
        >
          {section.label}
        </span>
        <ChevronDown
          className={cn(
            "h-3 w-3 transition-transform duration-200",
            !isOpen && "-rotate-90"
          )}
          style={{ color: "var(--muted-foreground)" }}
        />
      </button>

      {/* Collapsible items container */}
      <div
        className="overflow-hidden transition-[max-height] duration-200 ease-in-out"
        style={{ maxHeight: isOpen ? contentHeight : 0 }}
      >
        <div ref={contentRef} className="mt-1 space-y-0.5">
          {section.items.map((item) => {
            const isActive = isItemActive(item.href, pathname);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavClick}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "font-medium"
                    : "hover:bg-[var(--sidebar-accent)]"
                )}
                style={{
                  backgroundColor: isActive
                    ? "var(--sidebar-accent)"
                    : undefined,
                  color: isActive
                    ? "var(--sidebar-accent-foreground)"
                    : "var(--sidebar-foreground)",
                }}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap overflow-hidden">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SidebarContent({
  expanded,
  onNavClick,
  isMobile = false,
}: {
  expanded: boolean;
  onNavClick?: () => void;
  isMobile?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();

  // Track which sections are open. On mobile, default all open.
  // On desktop, default all open as well (they collapse/expand on click).
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    navSections.forEach((s) => {
      initial[s.label] = true;
    });
    return initial;
  });

  const toggleSection = (label: string) => {
    setOpenSections((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Sign out error:", error);
    } finally {
      router.push("/login");
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div
        className={cn(
          "flex items-center border-b",
          !expanded ? "h-14 px-0.5 justify-center" : "h-14 px-4 justify-start"
        )}
        style={{ borderColor: "var(--sidebar-border)" }}
      >
        {!expanded ? (
          <>
            <Image
              src="/logo-icon-blue.png"
              alt="RP"
              width={72}
              height={72}
              className="shrink-0 dark:hidden scale-125"
            />
            <Image
              src="/logo-icon-white.png"
              alt="RP"
              width={72}
              height={72}
              className="shrink-0 hidden dark:block scale-125"
            />
          </>
        ) : (
          <>
            <Image
              src="/favicon-blue.png"
              alt="Realtors' Practice"
              width={112}
              height={30}
              className="shrink-0 dark:hidden"
              style={{ objectFit: "contain" }}
            />
            <Image
              src="/favicon-white.png"
              alt="Realtors' Practice"
              width={112}
              height={30}
              className="shrink-0 hidden dark:block"
              style={{ objectFit: "contain" }}
            />
          </>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-none py-4 px-2 space-y-4 pb-24">
        {navSections.map((section) => (
          <CollapsibleSection
            key={section.label}
            section={section}
            expanded={expanded}
            isOpen={isMobile || openSections[section.label]}
            onToggle={() => toggleSection(section.label)}
            onNavClick={onNavClick}
            pathname={pathname}
          />
        ))}
      </nav>

      {/* Bottom section */}
      <div
        className="border-t px-2 py-3 space-y-2"
        style={{ borderColor: "var(--sidebar-border)" }}
      >
        {/* Profile */}
        <UserAvatar expanded={expanded} />

        {/* Logout */}
        <button
          onClick={handleLogout}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors w-full hover:bg-[var(--sidebar-accent)]",
            !expanded && "justify-center px-0"
          )}
          style={{ color: "var(--sidebar-foreground)" }}
          title={!expanded ? "Logout" : undefined}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {expanded && (
            <span className="whitespace-nowrap overflow-hidden">Logout</span>
          )}
        </button>
      </div>
    </div>
  );
}

// Desktop sidebar with hover-to-expand
export function AppSidebar() {
  const [expanded, setExpanded] = useState(false);

  return (
    <aside
      id="app-sidebar"
      className="hidden md:flex flex-col h-screen fixed left-0 top-0 z-[1001] border-r transition-all duration-300"
      style={{
        width: expanded ? 240 : 60,
        backgroundColor: "var(--sidebar)",
        borderColor: "var(--sidebar-border)",
      }}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      <SidebarContent expanded={expanded} />
    </aside>
  );
}

// Mobile sidebar — accepts open/onOpenChange props for external control
export function MobileSidebar({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const controls = useAnimation();
  const x = useMotionValue(0);
  const sheetWidth = 240; // Hardcoded w-[240px]
  
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      controls.start({
        x: 0,
        transition: {
          type: "spring",
          stiffness: 400,
          damping: 40,
          mass: 0.8,
        },
      });
    } else {
      document.body.style.overflow = "";
      controls.start({
        x: -sheetWidth - 50,
        transition: {
          type: "tween",
          ease: [0.25, 0.46, 0.45, 0.94],
          duration: 0.3,
        },
      });
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open, controls]);

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = sheetWidth * 0.3; // 30% of width
    const shouldClose = info.offset.x < -threshold || info.velocity.x < -800;

    if (shouldClose) {
      onOpenChange(false);
    } else {
      controls.start({
        x: 0,
        transition: {
          type: "spring",
          stiffness: 500,
          damping: 40,
        },
      });
    }
  };

  return (
    <>
      {/* Background overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: open ? 1 : 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="fixed inset-0 z-[999] bg-black/50 backdrop-blur-xs print:hidden"
        onClick={() => onOpenChange(false)}
        style={{ pointerEvents: open ? "auto" : "none" }}
      />
      
      {/* Sidebar surface */}
      <motion.aside
        drag="x"
        dragConstraints={{ left: -sheetWidth, right: 0 }}
        dragElastic={0}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        animate={controls}
        initial={{ x: -sheetWidth - 50 }}
        className="fixed left-0 top-0 z-[999] h-[100dvh] w-[240px] border-r shadow-2xl print:hidden"
        style={{
          backgroundColor: "var(--sidebar)",
          borderColor: "var(--sidebar-border)",
        }}
      >
        <div className="absolute top-1/2 -right-1.5 -translate-y-1/2 flex items-center pr-2">
          <div
            className="w-1.5 h-12 rounded-full opacity-30 cursor-grab active:cursor-grabbing"
            style={{ backgroundColor: "var(--foreground)" }}
          />
        </div>
        <SidebarContent
          expanded={true}
          onNavClick={() => onOpenChange(false)}
          isMobile={true}
        />
      </motion.aside>
    </>
  );
}
