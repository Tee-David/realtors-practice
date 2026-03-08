"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";
import { getSafeImageUrl } from "@/lib/image-utils";
import {
  BarChart3,
  Users,
  Key,
  User,
  Building2,
  ChevronRight,
  ChevronDown,
  Clipboard,
  Receipt,
  CreditCard,
  Settings,
  FileType,
  Folder,
  HandCoins,
  Banknote,
  Activity,
  MessageSquare,
  TrendingUp,
  UserCheck,
  FileSpreadsheet,
  Upload,
  Download,
  Target,
  FileText,
  LayoutDashboard,
  UsersRound,
  Briefcase,
  PieChart,
  Cog,
  RefreshCw,
} from "lucide-react";
import Image from "next/image";
import { UserRole } from "@/lib/enum";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";

export interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  children?: NavItem[];
  roles?: UserRole[];
  badge?: string;
  badgeVariant?: "default" | "success" | "warning" | "danger";
}

export interface NavigationData {
  main: NavItem[];
  sections: { title: string; items: NavItem[]; icon?: LucideIcon }[];
}

const navigationData: NavigationData = {
  main: [
    {
      name: "Dashboard",
      href: "/",
      icon: LayoutDashboard,
      roles: [UserRole.CREDIT_OFFICER, UserRole.ADMIN, UserRole.SUPERVISOR],
    },
  ],
  sections: [
    {
      title: "Staff",
      icon: UsersRound,
      items: [
        {
          name: "Users & Roles",
          href: "/staff-management/users",
          icon: Users,
          roles: [UserRole.ADMIN, UserRole.SUPERVISOR],
        },
      ],
    },
    {
      title: "Business",
      icon: Briefcase,
      items: [
        {
          name: "Unions",
          href: "/business-management/union",
          icon: Building2,
          roles: [UserRole.ADMIN, UserRole.SUPERVISOR],
        },
        {
          name: "Assignment",
          href: "/business-management/union-assignment",
          icon: UserCheck,
          roles: [UserRole.ADMIN, UserRole.SUPERVISOR],
        },
        {
          name: "Members",
          href: "/business-management/customer",
          icon: User,
          roles: [UserRole.CREDIT_OFFICER, UserRole.ADMIN, UserRole.SUPERVISOR],
        },
        {
          name: "Loans",
          href: "/business-management/loan",
          icon: Banknote,
          roles: [UserRole.CREDIT_OFFICER, UserRole.ADMIN, UserRole.SUPERVISOR],
        },
        {
          name: "Repayments",
          href: "/business-management/loan-payment/repayment",
          icon: Receipt,
          roles: [UserRole.CREDIT_OFFICER, UserRole.ADMIN, UserRole.SUPERVISOR],
        },
        {
          name: "Schedules",
          href: "/business-management/loan-payment/repayment-schedules",
          icon: Clipboard,
          roles: [UserRole.CREDIT_OFFICER, UserRole.ADMIN, UserRole.SUPERVISOR],
        },
      ],
    },
    {
      title: "Analytics",
      icon: PieChart,
      items: [
        {
          name: "Supervisor Reports",
          href: "/supervisor-reports",
          icon: Target,
          roles: [UserRole.ADMIN, UserRole.SUPERVISOR],
        },
        {
          name: "Audit Logs",
          href: "/system-configuration/audit-logs",
          icon: Activity,
          roles: [UserRole.ADMIN, UserRole.SUPERVISOR],
        },
      ],
    },
    {
      title: "Configuration",
      icon: Cog,
      items: [
        {
          name: "Loan Types",
          href: "/system-configuration/loan-type",
          icon: FileType,
          roles: [UserRole.ADMIN],
        },
        {
          name: "Document Types",
          href: "/system-configuration/document-type",
          icon: Folder,
          roles: [UserRole.ADMIN],
        },
      ],
    },
    {
      title: "System",
      icon: Settings,
      items: [
        {
          name: "Settings",
          href: "/settings",
          icon: Settings,
          roles: [UserRole.ADMIN],
        },
      ],
    },
  ],
};

function normalizeUserRoles(userRoles?: UserRole[] | UserRole): UserRole[] {
  if (!userRoles) return [];
  return Array.isArray(userRoles) ? userRoles : [userRoles];
}

function filterNavItemsByRoles(
  items: NavItem[],
  userRoles: UserRole[]
): NavItem[] {
  return items
    .filter((item) => {
      if (!item.roles) return true;
      return item.roles.some((role) => userRoles.includes(role));
    })
    .map((item) => ({
      ...item,
      children: item.children
        ? filterNavItemsByRoles(item.children, userRoles)
        : undefined,
    }))
    .filter((item) => !(item.children && item.children.length === 0));
}

interface AppSidebarProps {
  userRoles?: UserRole[] | UserRole;
}

export function AppSidebar({ userRoles }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [expandedSections, setExpandedSections] = React.useState<string[]>([]);
  const { logo } = useCompany();
  const { state } = useSidebar();

  const navigate = (href: string) => {
    router.push(href);
  };

  const rolesArray = normalizeUserRoles(userRoles);

  // Auto-expand section containing active item
  React.useEffect(() => {
    const activeSection = navigationData.sections.find((section) =>
      section.items.some(
        (item) =>
          pathname === item.href ||
          pathname.startsWith(item.href + "/") ||
          item.children?.some(
            (child) =>
              pathname === child.href || pathname.startsWith(child.href + "/")
          )
      )
    );
    if (activeSection && !expandedSections.includes(activeSection.title)) {
      setExpandedSections((prev) => [...prev, activeSection.title]);
    }
  }, [pathname]);

  const toggleSection = (sectionTitle: string) => {
    setExpandedSections((prev) =>
      prev.includes(sectionTitle)
        ? prev.filter((t) => t !== sectionTitle)
        : [...prev, sectionTitle]
    );
  };

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const filteredMain = filterNavItemsByRoles(navigationData.main, rolesArray);
  const filteredSections = navigationData.sections
    .map((section) => ({
      ...section,
      items: filterNavItemsByRoles(section.items, rolesArray),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border p-5">
        <div className="flex items-center gap-3">
          {/* Light Mode Logo */}
          <Image
            src="/mp-logo.png"
            alt="Company Logo"
            width={state === "collapsed" ? 56 : 240}
            height={state === "collapsed" ? 56 : 120}
            className={cn(
              "object-contain transition-all duration-300 dark:hidden",
              state === "collapsed" ? "h-14 w-14" : "h-28 w-full"
            )}
            priority
            key="mp-logo-light"
            style={{
              width: state === "collapsed" ? "56px" : "100%",
              height: state === "collapsed" ? "56px" : "112px",
              maxWidth: "100%",
            }}
            onError={(e) => {
              e.currentTarget.src = "/logo.png";
            }}
          />
          {/* Dark Mode Logo */}
          <Image
            src={(logo ? getSafeImageUrl(logo) : null) || "/mp-logo-white.png"}
            alt="Company Logo"
            width={state === "collapsed" ? 56 : 240}
            height={state === "collapsed" ? 56 : 120}
            className={cn(
              "object-contain transition-all duration-300 hidden dark:block",
              state === "collapsed" ? "h-14 w-14" : "h-28 w-full"
            )}
            priority
            key={`${logo}-dark`}
            style={{
              width: state === "collapsed" ? "56px" : "100%",
              height: state === "collapsed" ? "56px" : "112px",
              maxWidth: "100%",
            }}
            onError={(e) => {
              e.currentTarget.src = "/logo.png";
            }}
          />
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Main Navigation */}
        {filteredMain.length > 0 && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredMain.map((item) => (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton
                      isActive={isActive(item.href)}
                      tooltip={item.name}
                      onClick={() => navigate(item.href)}
                      className={cn(
                        "transition-all duration-200 cursor-pointer",
                        isActive(item.href)
                          ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/25 hover:from-green-600 hover:to-emerald-600"
                          : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                      )}
                    >
                      <item.icon className="w-5 h-5" />
                      <span>{item.name}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Sections */}
        {filteredSections.map((section) => {
          const SectionIcon = section.icon || Folder;
          const isExpanded = expandedSections.includes(section.title);
          const hasActiveItem = section.items.some((item) =>
            isActive(item.href)
          );

          return (
            <SidebarGroup key={section.title}>
              <SidebarGroupLabel
                className={cn(
                  "cursor-pointer transition-all duration-200 group",
                  hasActiveItem || isExpanded
                    ? "text-sidebar-foreground bg-sidebar-accent/60"
                    : "text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/40"
                )}
                onClick={() => toggleSection(section.title)}
                id={`tour-sidebar-section-${section.title.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <div
                  className={cn(
                    "flex items-center justify-center p-1 rounded-lg transition-all duration-200",
                    hasActiveItem ? "bg-green-100" : "bg-transparent"
                  )}
                >
                  <SectionIcon
                    className={cn(
                      "w-4 h-4 transition-colors",
                      hasActiveItem ? "text-green-600" : "text-current"
                    )}
                  />
                </div>
                <span className="flex-1 uppercase tracking-wider text-xs font-semibold">
                  {section.title}
                </span>
                <ChevronDown
                  className={cn(
                    "w-4 h-4 transition-transform duration-200",
                    isExpanded ? "rotate-180" : ""
                  )}
                />
              </SidebarGroupLabel>

              {isExpanded && (
                <SidebarGroupContent>
                  <SidebarMenu>
                    {section.items.map((item) => (
                      <SidebarMenuItem key={item.name}>
                        <SidebarMenuButton
                          isActive={isActive(item.href)}
                          tooltip={item.name}
                          onClick={() => navigate(item.href)}
                          className={cn(
                            "transition-all duration-200 cursor-pointer",
                            isActive(item.href)
                              ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/25 hover:from-green-600 hover:to-emerald-600"
                              : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                          )}
                          id={`tour-sidebar-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                        >
                          <item.icon className="w-4 h-4" />
                          <span>{item.name}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              )}
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter>
         <button
            onClick={() => window.dispatchEvent(new CustomEvent('start-onboarding-tour'))}
            className="md:hidden flex items-center justify-center gap-2 mb-4 mx-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50 shadow-sm"
          >
            <RefreshCw className="h-4 w-4" />
            <span className="text-sm font-medium">Take interactive tour</span>
          </button>
      </SidebarFooter>
    </Sidebar>
  );
}
