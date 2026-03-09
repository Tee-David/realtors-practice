"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import {
  User,
  Shield,
  Bell,
  Palette,
  Info,
  Eye,
  EyeOff,
  Monitor,
  Sun,
  Moon,
  MapPin,
  Globe,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ThemeSwitch } from "@/components/ui/theme-switch";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabId = "profile" | "security" | "notifications" | "preferences" | "about" | "env" | "users";

interface TabDef {
  id: TabId;
  label: string;
  icon: React.ElementType;
}

const TABS: TabDef[] = [
  { id: "profile", label: "My Profile", icon: User },
  { id: "security", label: "Security", icon: Shield },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "preferences", label: "Preferences", icon: Palette },
  { id: "users", label: "User Management", icon: Shield },
  { id: "env", label: "Environment Config", icon: Monitor },
  { id: "about", label: "About", icon: Info },
];

// ---------------------------------------------------------------------------
// Reusable small components
// ---------------------------------------------------------------------------

function FormField({
  label,
  value,
  type = "text",
  disabled = true,
}: {
  label: string;
  value: string;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
        {label}
      </label>
      <Input type={type} defaultValue={value} disabled={disabled} className="max-w-md" />
    </div>
  );
}

function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      style={{ backgroundColor: checked ? "var(--primary)" : "var(--muted)" }}
    >
      <span
        className="pointer-events-none inline-block h-5 w-5 rounded-full shadow-lg ring-0 transition-transform duration-200 ease-in-out"
        style={{
          backgroundColor: "var(--card)",
          transform: checked ? "translateX(1.25rem)" : "translateX(0)",
        }}
      />
    </button>
  );
}

function PasswordInput({
  label,
  placeholder,
}: {
  label: string;
  placeholder: string;
}) {
  const [show, setShow] = useState(false);

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
        {label}
      </label>
      <div className="relative max-w-md">
        <Input type={show ? "text" : "password"} placeholder={placeholder} />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2"
          style={{ color: "var(--muted-foreground)" }}
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab content panels
// ---------------------------------------------------------------------------

function ProfileTab() {
  const initials = "JD";

  return (
    <div className="space-y-8">
      {/* Avatar + name header */}
      <div className="flex items-center gap-4">
        <div
          className="flex size-20 shrink-0 items-center justify-center rounded-full text-2xl font-display font-bold"
          style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          {initials}
        </div>
        <div>
          <h3 className="text-lg font-display font-semibold" style={{ color: "var(--foreground)" }}>
            John Doe
          </h3>
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            Real Estate Agent
          </p>
        </div>
      </div>

      <Separator />

      {/* Personal Information */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display font-semibold" style={{ color: "var(--foreground)" }}>
            Personal Information
          </h3>
          <Button variant="outline" size="sm" disabled>
            Edit
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="First Name" value="John" />
          <FormField label="Last Name" value="Doe" />
          <FormField label="Email" value="john.doe@example.com" type="email" />
          <FormField label="Phone" value="+234 801 234 5678" type="tel" />
        </div>

        <div className="mt-4">
          <FormField label="Bio / Role" value="Real Estate Agent" />
        </div>
      </div>

      <Separator />

      {/* Address */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display font-semibold" style={{ color: "var(--foreground)" }}>
            Address
          </h3>
          <Button variant="outline" size="sm" disabled>
            Edit
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Country" value="Nigeria" />
          <FormField label="City" value="Lagos" />
        </div>
      </div>
    </div>
  );
}

function SecurityTab() {
  const [twoFA, setTwoFA] = useState(false);

  return (
    <div className="space-y-8">
      {/* Change Password */}
      <div>
        <h3 className="mb-4 font-display font-semibold" style={{ color: "var(--foreground)" }}>
          Change Password
        </h3>

        <div className="space-y-4">
          <PasswordInput label="Current Password" placeholder="Enter current password" />
          <PasswordInput label="New Password" placeholder="Enter new password" />
          <PasswordInput label="Confirm New Password" placeholder="Confirm new password" />
        </div>

        <Button className="mt-4" disabled>
          Update Password
        </Button>
      </div>

      <Separator />

      {/* Two-Factor Authentication */}
      <div>
        <h3 className="mb-1 font-display font-semibold" style={{ color: "var(--foreground)" }}>
          Two-Factor Authentication
        </h3>
        <p className="mb-4 text-sm" style={{ color: "var(--muted-foreground)" }}>
          Add an extra layer of security to your account.
        </p>

        <div className="flex items-center justify-between rounded-lg border p-4" style={{ borderColor: "var(--border)" }}>
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
              Enable 2FA
            </p>
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              Coming soon
            </p>
          </div>
          <ToggleSwitch checked={twoFA} onChange={setTwoFA} disabled />
        </div>
      </div>

      <Separator />

      {/* Active Sessions */}
      <div>
        <h3 className="mb-1 font-display font-semibold" style={{ color: "var(--foreground)" }}>
          Active Sessions
        </h3>
        <p className="mb-4 text-sm" style={{ color: "var(--muted-foreground)" }}>
          Manage devices where you are currently logged in.
        </p>

        <div className="space-y-3">
          {[
            { device: "Chrome on Windows", location: "Lagos, Nigeria", current: true },
            { device: "Safari on iPhone", location: "Lagos, Nigeria", current: false },
          ].map((session) => (
            <div
              key={session.device}
              className="flex items-center justify-between rounded-lg border p-4"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="flex items-center gap-3">
                <Globe className="size-5" style={{ color: "var(--muted-foreground)" }} />
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                    {session.device}
                  </p>
                  <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                    {session.location}
                    {session.current && " \u2014 Current session"}
                  </p>
                </div>
              </div>
              {!session.current && (
                <Button variant="outline" size="sm" disabled>
                  Revoke
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function NotificationsTab() {
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [inAppNotifs, setInAppNotifs] = useState(true);
  const [scraperAlerts, setScraperAlerts] = useState(false);
  const [newPropertyAlerts, setNewPropertyAlerts] = useState(true);
  const [savedSearchAlerts, setSavedSearchAlerts] = useState(false);

  const toggles: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }[] = [
    {
      label: "Email Notifications",
      description: "Receive important updates via email.",
      checked: emailNotifs,
      onChange: setEmailNotifs,
    },
    {
      label: "In-App Notifications",
      description: "Get notified inside the application.",
      checked: inAppNotifs,
      onChange: setInAppNotifs,
    },
    {
      label: "Scraper Alerts",
      description: "Be notified when a scraping job completes or fails.",
      checked: scraperAlerts,
      onChange: setScraperAlerts,
    },
    {
      label: "New Property Alerts",
      description: "Get alerts when new properties are added.",
      checked: newPropertyAlerts,
      onChange: setNewPropertyAlerts,
    },
    {
      label: "Saved Search Match Alerts",
      description: "Be notified when new listings match your saved searches.",
      checked: savedSearchAlerts,
      onChange: setSavedSearchAlerts,
    },
  ];

  return (
    <div className="space-y-2">
      <h3 className="mb-4 font-display font-semibold" style={{ color: "var(--foreground)" }}>
        Notification Preferences
      </h3>

      <div className="space-y-1">
        {toggles.map((t) => (
          <div
            key={t.label}
            className="flex items-center justify-between rounded-lg border p-4"
            style={{ borderColor: "var(--border)" }}
          >
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                {t.label}
              </p>
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                {t.description}
              </p>
            </div>
            <ToggleSwitch checked={t.checked} onChange={t.onChange} />
          </div>
        ))}
      </div>
    </div>
  );
}

import { useThemeConfig } from "@/components/theme-config-provider";

function PreferencesTab() {
  const { theme, setTheme } = useTheme();
  const { 
    primaryLight, primaryDark, setPrimaryLight, setPrimaryDark, 
    fontDisplay, setFontDisplay, fontBody, setFontBody, resetTheme 
  } = useThemeConfig();

  const [mapProvider, setMapProvider] = useState("osm");
  const [perPage, setPerPage] = useState("24");
  const [sortOrder, setSortOrder] = useState("newest");
  const [autoSubmitVoice, setAutoSubmitVoice] = useState(false);

  // Load initial settings from localStorage on mount
  useEffect(() => {
    const savedAutoSubmit = localStorage.getItem("realtors_auto_submit_voice");
    if (savedAutoSubmit) {
      setAutoSubmitVoice(savedAutoSubmit === "true");
    }
    const savedMapProvider = localStorage.getItem("map-provider-storage");
    if (savedMapProvider) {
      try {
        const parsed = JSON.parse(savedMapProvider);
        if (parsed?.state?.provider) setMapProvider(parsed.state.provider);
      } catch (e) {}
    }
  }, []);

  const handleAutoSubmitVoiceChange = (val: boolean) => {
    setAutoSubmitVoice(val);
    localStorage.setItem("realtors_auto_submit_voice", val.toString());
  };

  const FONTS = [
    "Space Grotesk", "Outfit", "Inter", "Roboto", "Poppins", 
    "Montserrat", "Open Sans", "Lato", "Plus Jakarta Sans"
  ];

  return (
    <div className="space-y-8">
      {/* Theme */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="mb-1 font-display font-semibold" style={{ color: "var(--foreground)" }}>
              Appearance
            </h3>
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              Customize how the app looks.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={resetTheme}>Reset Defaults</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-zinc-500/5 p-5 rounded-2xl border border-border/50">
          
          {/* Base Mode */}
          <div className="space-y-3">
             <label className="text-sm font-medium" style={{ color: "var(--foreground)" }}>Base Theme</label>
             <div className="flex gap-2">
                {[
                  { value: "light", label: "Light", Icon: Sun },
                  { value: "dark", label: "Dark", Icon: Moon },
                  { value: "system", label: "System", Icon: Monitor },
                ].map(({ value, label, Icon }) => (
                  <Button
                    key={value}
                    variant={theme === value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTheme(value)}
                    className="gap-1.5 flex-1"
                  >
                    <Icon className="size-4" />
                    {label}
                  </Button>
                ))}
              </div>
          </div>

          {/* Typography */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium" style={{ color: "var(--foreground)" }}>Display Font</label>
                <Select value={fontDisplay} onValueChange={setFontDisplay}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FONTS.map(f => <SelectItem key={f} value={f} style={{ fontFamily: `"${f}", sans-serif` }}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" style={{ color: "var(--foreground)" }}>Body Font</label>
                <Select value={fontBody} onValueChange={setFontBody}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FONTS.map(f => <SelectItem key={f} value={f} style={{ fontFamily: `"${f}", sans-serif` }}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Accent Colors */}
          <div className="col-span-1 md:col-span-2 pt-4 border-t border-border/50">
            <label className="text-sm font-medium block mb-3" style={{ color: "var(--foreground)" }}>Brand Colors</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
               <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Light Mode Primary</p>
                  <div className="flex items-center gap-2">
                    <input 
                      type="color" 
                      value={primaryLight} 
                      onChange={(e) => setPrimaryLight(e.target.value)}
                      className="w-10 h-10 rounded border-0 cursor-pointer p-0 bg-transparent"
                    />
                    <Input 
                      value={primaryLight} 
                      onChange={(e) => setPrimaryLight(e.target.value)}
                      className="font-mono text-xs uppercase"
                    />
                  </div>
               </div>
               <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Dark Mode Primary</p>
                  <div className="flex items-center gap-2">
                    <input 
                      type="color" 
                      value={primaryDark} 
                      onChange={(e) => setPrimaryDark(e.target.value)}
                      className="w-10 h-10 rounded border-0 cursor-pointer p-0 bg-transparent"
                    />
                    <Input 
                      value={primaryDark} 
                      onChange={(e) => setPrimaryDark(e.target.value)}
                      className="font-mono text-xs uppercase"
                    />
                  </div>
               </div>
            </div>
          </div>
        </div>
      </div>
      {/* Theme */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="mb-1 font-display font-semibold" style={{ color: "var(--foreground)" }}>
              Appearance
            </h3>
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              Customize how the app looks.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={resetTheme}>Reset Defaults</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-zinc-500/5 p-5 rounded-2xl border border-border/50">
          
          {/* Base Mode */}
          <div className="space-y-3">
             <label className="text-sm font-medium" style={{ color: "var(--foreground)" }}>Base Theme</label>
             <div className="flex gap-2">
                {[
                  { value: "light", label: "Light", Icon: Sun },
                  { value: "dark", label: "Dark", Icon: Moon },
                  { value: "system", label: "System", Icon: Monitor },
                ].map(({ value, label, Icon }) => (
                  <Button
                    key={value}
                    variant={theme === value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTheme(value)}
                    className="gap-1.5 flex-1"
                  >
                    <Icon className="size-4" />
                    {label}
                  </Button>
                ))}
              </div>
          </div>

          {/* Typography */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium" style={{ color: "var(--foreground)" }}>Display Font</label>
                <Select value={fontDisplay} onValueChange={setFontDisplay}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FONTS.map(f => <SelectItem key={f} value={f} style={{ fontFamily: `"${f}", sans-serif` }}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" style={{ color: "var(--foreground)" }}>Body Font</label>
                <Select value={fontBody} onValueChange={setFontBody}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FONTS.map(f => <SelectItem key={f} value={f} style={{ fontFamily: `"${f}", sans-serif` }}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Accent Colors */}
          <div className="col-span-1 md:col-span-2 pt-4 border-t border-border/50">
            <label className="text-sm font-medium block mb-3" style={{ color: "var(--foreground)" }}>Brand Colors</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
               <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Light Mode Primary</p>
                  <div className="flex items-center gap-2">
                    <input 
                      type="color" 
                      value={primaryLight} 
                      onChange={(e) => setPrimaryLight(e.target.value)}
                      className="w-10 h-10 rounded border-0 cursor-pointer p-0 bg-transparent"
                    />
                    <Input 
                      value={primaryLight} 
                      onChange={(e) => setPrimaryLight(e.target.value)}
                      className="font-mono text-xs uppercase"
                    />
                  </div>
               </div>
               <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Dark Mode Primary</p>
                  <div className="flex items-center gap-2">
                    <input 
                      type="color" 
                      value={primaryDark} 
                      onChange={(e) => setPrimaryDark(e.target.value)}
                      className="w-10 h-10 rounded border-0 cursor-pointer p-0 bg-transparent"
                    />
                    <Input 
                      value={primaryDark} 
                      onChange={(e) => setPrimaryDark(e.target.value)}
                      className="font-mono text-xs uppercase"
                    />
                  </div>
               </div>
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* Default Map Provider */}
      <div>
        <h3 className="mb-1 font-display font-semibold" style={{ color: "var(--foreground)" }}>
          Default Map Provider
        </h3>
        <p className="mb-4 text-sm" style={{ color: "var(--muted-foreground)" }}>
          Select the map service used across the application.
        </p>

        <div className="flex items-center gap-3">
          <MapPin className="size-5" style={{ color: "var(--muted-foreground)" }} />
          <Select value={mapProvider} onValueChange={setMapProvider}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="osm">OpenStreetMap (Free)</SelectItem>
              <SelectItem value="mapbox">Mapbox</SelectItem>
              <SelectItem value="google">Google Maps</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      {/* Properties per page */}
      <div>
        <h3 className="mb-1 font-display font-semibold" style={{ color: "var(--foreground)" }}>
          Properties Per Page
        </h3>
        <p className="mb-4 text-sm" style={{ color: "var(--muted-foreground)" }}>
          Number of property listings displayed per page.
        </p>

        <Select value={perPage} onValueChange={setPerPage}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="12">12</SelectItem>
            <SelectItem value="24">24</SelectItem>
            <SelectItem value="48">48</SelectItem>
            <SelectItem value="96">96</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {/* Default Sort Order */}
      <div>
        <h3 className="mb-1 font-display font-semibold" style={{ color: "var(--foreground)" }}>
          Default Sort Order
        </h3>
        <p className="mb-4 text-sm" style={{ color: "var(--muted-foreground)" }}>
          How property listings are ordered by default.
        </p>

        <Select value={sortOrder} onValueChange={setSortOrder}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest First</SelectItem>
            <SelectItem value="oldest">Oldest First</SelectItem>
            <SelectItem value="price-asc">Price: Low to High</SelectItem>
            <SelectItem value="price-desc">Price: High to Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {/* Voice Search Auto-submit */}
      <div>
        <h3 className="mb-1 font-display font-semibold" style={{ color: "var(--foreground)" }}>
          Voice Search Auto-Submit
        </h3>
        <p className="mb-4 text-sm" style={{ color: "var(--muted-foreground)" }}>
          Automatically submit search queries when you finish speaking.
        </p>

        <div className="flex items-center justify-between rounded-lg border p-4 max-w-sm" style={{ borderColor: "var(--border)" }}>
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
              Enable Auto-Submit
            </p>
          </div>
          <ToggleSwitch checked={autoSubmitVoice} onChange={handleAutoSubmitVoiceChange} />
        </div>
      </div>
    </div>
  );
}

function AboutTab() {
  const info: { label: string; value: string }[] = [
    { label: "App Name", value: "Realtors' Practice" },
    { label: "Version", value: "3.0.0" },
    { label: "Developed By", value: "WDC Solutions Hub" },
    { label: "Frontend", value: "Next.js 15 / React 19" },
    { label: "Backend", value: "Node.js / Express / Prisma" },
    { label: "Database", value: "CockroachDB" },
    { label: "Search Engine", value: "Meilisearch" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-1 font-display font-semibold" style={{ color: "var(--foreground)" }}>
          Application Information
        </h3>
        <p className="mb-4 text-sm" style={{ color: "var(--muted-foreground)" }}>
          Details about this installation.
        </p>
      </div>

      <div className="space-y-1">
        {info.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between rounded-lg border p-4"
            style={{ borderColor: "var(--border)" }}
          >
            <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
              {item.label}
            </span>
            <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              {item.value}
            </span>
          </div>
        ))}
      </div>

      <Separator />

      <p className="text-xs leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
        Realtors' Practice is a comprehensive Nigerian property intelligence platform. It provides automated scraping, data validation, property enrichment, advanced search, and intelligent analytics for real estate listings across Nigeria. Built to empower modern realtors with actionable property insights.
      </p>
    </div>
  );
}

import { toast } from "sonner";

function EnvConfigTab() {
  const [rawEnv, setRawEnv] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchEnv();
  }, []);

  const fetchEnv = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("realtors_token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/env`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setRawEnv(data.data.raw);
      } else {
        toast.error(data.message || "Failed to load environment variables");
      }
    } catch (err: any) {
      toast.error(err.message || "Error connecting to server");
    } finally {
      setLoading(false);
    }
  };

  const saveEnv = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem("realtors_token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/env`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ rawContent: rawEnv })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "Environment variables saved successfully. Server may require restart.");
      } else {
        toast.error(data.message || "Failed to save environment variables");
      }
    } catch (err: any) {
      toast.error(err.message || "Error saving environment variables");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 flex flex-col h-[600px]">
      <div>
        <h3 className="mb-1 font-display font-semibold text-destructive flex items-center gap-2">
          <Shield className="size-4" /> Danger Zone: Environment Variables
        </h3>
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          Modify server-side and client-side secrets. Syntax errors or invalid database URLs may break the platform. Changes are validated before saving.
        </p>
      </div>

      <div className="flex-1 min-h-0 relative">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-card/50">Loading config...</div>
        ) : (
          <textarea 
             value={rawEnv}
             onChange={(e) => setRawEnv(e.target.value)}
             className="w-full h-full p-4 font-mono text-sm bg-zinc-950 text-emerald-400 rounded-lg border focus:ring-primary focus:border-primary resize-none"
             spellCheck={false}
             placeholder="DATABASE_URL=..."
          />
        )}
      </div>

      <div className="flex justify-end pt-2">
         <Button onClick={saveEnv} disabled={loading || saving} className="gap-2">
           {saving ? "Validating & Saving..." : "Save Configuration"}
         </Button>
      </div>
    </div>
  );
}

function UserAdminTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("realtors_token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setUsers(data.data);
      }
    } catch (err: any) {
      toast.error("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  const updateRole = async (id: string, newRole: string) => {
    try {
      const token = localStorage.getItem("realtors_token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/${id}/role`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ role: newRole })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`User role updated to ${newRole}`);
        fetchUsers();
      } else {
        toast.error(data.message || "Failed to update role");
      }
    } catch (err: any) {
      toast.error("Error updating role");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-1 font-display font-semibold" style={{ color: "var(--foreground)" }}>
          User Management
        </h3>
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          Manage user roles and approve pending administrators.
        </p>
      </div>

      <div className="rounded-md border overflow-hidden">
        {loading ? (
           <div className="p-8 text-center text-muted-foreground">Loading users...</div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map(u => (
                <tr key={u.id} className="bg-card">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{u.firstName} {u.lastName}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      u.role === 'ADMIN' ? 'bg-primary/10 text-primary' :
                      u.role === 'PENDING_ADMIN' ? 'bg-amber-500/10 text-amber-500' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Select value={u.role} onValueChange={(val) => updateRole(u.id, val)}>
                      <SelectTrigger className="w-[140px] h-8 ml-auto">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                         <SelectItem value="ADMIN">Admin</SelectItem>
                         <SelectItem value="PENDING_ADMIN">Pending Admin</SelectItem>
                         <SelectItem value="EDITOR">Editor</SelectItem>
                         <SelectItem value="VIEWER">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-muted-foreground">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Settings Page
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("profile");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Basic frontend check. Real security is handled by backend.
    const checkRole = async () => {
      try {
        const token = localStorage.getItem("realtors_token");
        if (!token) return;
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success && data.data?.role === "ADMIN") {
          setIsAdmin(true);
        }
      } catch (err) {}
    };
    checkRole();
  }, []);

  const visibleTabs = TABS.filter(t => {
    if (t.id === "env" || t.id === "users") return isAdmin;
    return true;
  });

  const ActivePanel = {
    profile: ProfileTab,
    security: SecurityTab,
    notifications: NotificationsTab,
    preferences: PreferencesTab,
    env: EnvConfigTab,
    users: UserAdminTab,
    about: AboutTab,
  }[activeTab] || ProfileTab;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-display font-bold" style={{ color: "var(--foreground)" }}>
          Settings
        </h1>
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          Manage your account settings and preferences.
        </p>
      </div>

      {/* Layout: sidebar tabs + content */}
      <div className="flex flex-col gap-6 md:flex-row">
        {/* Tab navigation */}
        <nav className="w-full shrink-0 md:w-56">
          <Card className="p-2">
            <ul className="flex flex-row gap-1 overflow-x-auto md:flex-col scrollbar-none">
              {visibleTabs.map((tab) => {
                const isActive = activeTab === tab.id;
                const Icon = tab.icon;

                return (
                  <li key={tab.id}>
                    <button
                      onClick={() => setActiveTab(tab.id)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap"
                      style={{
                        backgroundColor: isActive ? "var(--sidebar-accent)" : "transparent",
                        color: isActive ? "var(--sidebar-accent-foreground)" : "var(--muted-foreground)",
                      }}
                    >
                      <Icon className="size-4 shrink-0" />
                      {tab.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
        </nav>

        {/* Content area */}
        <Card className="min-w-0 flex-1 p-6">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="font-display">
              {visibleTabs.find((t) => t.id === activeTab)?.label}
            </CardTitle>
            <CardDescription>
              {activeTab === "profile" && "View and manage your personal information."}
              {activeTab === "security" && "Keep your account secure."}
              {activeTab === "notifications" && "Choose what notifications you receive."}
              {activeTab === "preferences" && "Customize your experience."}
              {activeTab === "env" && "Super Admin environment variables."}
              {activeTab === "users" && "Manage application users and roles."}
              {activeTab === "about" && "About this application."}
            </CardDescription>
          </CardHeader>
          <Separator className="mb-6" />
          <CardContent className="p-0">
            <ActivePanel />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

