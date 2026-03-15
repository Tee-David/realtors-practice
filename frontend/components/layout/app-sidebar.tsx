"use client";

import { useState, useEffect } from "react";
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
  Settings,
  ScrollText,
  Menu,
  X,
  LogOut,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  section: string;
}

const navItems: NavItem[] = [
  // MAIN
  { label: "Dashboard", href: "/", icon: LayoutDashboard, section: "MAIN" },
  { label: "Properties", href: "/properties", icon: Building2, section: "MAIN" },
  { label: "Search", href: "/search", icon: Search, section: "MAIN" },

  // DATA & TOOLS
  { label: "Data Explorer", href: "/data-explorer", icon: Database, section: "DATA & TOOLS" },
  { label: "Sites", href: "/scraper/sites", icon: Globe, section: "DATA & TOOLS" },
  { label: "Scraper", href: "/scraper", icon: Bot, section: "DATA & TOOLS" },

  // ANALYTICS
  { label: "Analytics", href: "/analytics", icon: BarChart3, section: "ANALYTICS" },
  { label: "Saved Searches", href: "/saved-searches", icon: Bookmark, section: "ANALYTICS" },

  // SYSTEM
  { label: "Audit Log", href: "/audit-log", icon: ScrollText, section: "SYSTEM" },
  { label: "Settings", href: "/settings", icon: Settings, section: "SYSTEM" },
];

const sections = [...new Set(navItems.map((item) => item.section))];

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

function SidebarContent({
  expanded,
  onNavClick,
}: {
  expanded: boolean;
  onNavClick?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();

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
      <nav className="flex-1 overflow-y-auto scrollbar-none py-4 px-2 space-y-6 pb-24">
        {sections.map((section) => (
          <div key={section}>
            {expanded && (
              <span
                className="px-3 text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--muted-foreground)" }}
              >
                {section}
              </span>
            )}
            <div className="mt-2 space-y-1">
              {navItems
                .filter((item) => item.section === section)
                .map((item) => {
                  const isActive =
                    item.href === "/"
                      ? pathname === "/"
                      : pathname === item.href || (pathname.startsWith(item.href) && item.href !== "/scraper");
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavClick}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                        !expanded && "justify-center px-0",
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
                      title={!expanded ? item.label : undefined}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {expanded && (
                        <span className="whitespace-nowrap overflow-hidden">
                          {item.label}
                        </span>
                      )}
                    </Link>
                  );
                })}
            </div>
          </div>
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
        />
      </motion.aside>
    </>
  );
}
