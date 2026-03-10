"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import {
  User, Shield, Bell, Palette, Info, Eye, EyeOff, Monitor, Sun, Moon,
  MapPin, Globe, ChevronRight, ArrowLeft, Save, Link2, Unlink2,
  Database, Mail, Server, HardDrive, Clock, Trash2, Plus, Download,
  RefreshCcw, Settings2, Mic, SortAsc, LayoutGrid, FileCode,
  Users, CheckCircle2, AlertCircle, X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabId = "profile" | "security" | "notifications" | "preferences" | "data" | "email" | "backup" | "about" | "env" | "users";

interface TabDef {
  id: TabId;
  label: string;
  description: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}

const TABS: TabDef[] = [
  { id: "profile", label: "Profile", description: "Personal information & avatar", icon: User },
  { id: "security", label: "Security", description: "Passwords, 2FA & linked accounts", icon: Shield },
  { id: "notifications", label: "Notifications", description: "Email & in-app alerts", icon: Bell },
  { id: "preferences", label: "Appearance", description: "Theme, fonts & colors", icon: Palette },
  { id: "data", label: "Data & Display", description: "Map, pagination, sorting & voice", icon: Settings2 },
  { id: "email", label: "Email Settings", description: "Templates & email configuration", icon: Mail },
  { id: "backup", label: "Backups", description: "Create & manage data backups", icon: HardDrive },
  { id: "users", label: "User Management", description: "Manage users & roles", icon: Users, adminOnly: true },
  { id: "env", label: "Environment", description: "Server environment variables", icon: Server, adminOnly: true },
  { id: "about", label: "About", description: "App info & tech stack", icon: Info },
];

// ---------------------------------------------------------------------------
// Small reusable components
// ---------------------------------------------------------------------------

function ToggleSwitch({ checked, onChange, disabled = false }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      style={{ backgroundColor: checked ? "var(--primary)" : "var(--muted)" }}>
      <span className="pointer-events-none inline-block h-5 w-5 rounded-full shadow-lg ring-0 transition-transform"
        style={{ backgroundColor: "var(--card)", transform: checked ? "translateX(1.25rem)" : "translateX(0)" }} />
    </button>
  );
}

function PasswordInput({ label, placeholder, value, onChange }: { label: string; placeholder: string; value?: string; onChange?: (v: string) => void }) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <div className="relative max-w-md">
        <Input type={show ? "text" : "password"} placeholder={placeholder} value={value} onChange={e => onChange?.(e.target.value)} />
        <button type="button" onClick={() => setShow(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </div>
  );
}

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-4 border-border">
      <div className="min-w-0 flex-1 mr-4">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4">
      <h3 className="font-display font-semibold text-foreground">{title}</h3>
      {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab Panels
// ---------------------------------------------------------------------------

function ProfileTab() {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    firstName: "", lastName: "", email: "", phone: "", bio: "", country: "Nigeria", city: "Lagos",
  });

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setProfile(p => ({
            ...p,
            firstName: user.user_metadata?.first_name || user.user_metadata?.full_name?.split(' ')[0] || "",
            lastName: user.user_metadata?.last_name || user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || "",
            email: user.email || "",
            phone: user.phone || user.user_metadata?.phone || "",
            bio: user.user_metadata?.bio || "",
            country: user.user_metadata?.country || "Nigeria",
            city: user.user_metadata?.city || "Lagos",
          }));
        }
      } catch {}
    };
    loadProfile();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          first_name: profile.firstName,
          last_name: profile.lastName,
          full_name: `${profile.firstName} ${profile.lastName}`,
          phone: profile.phone,
          bio: profile.bio,
          country: profile.country,
          city: profile.city,
        },
      });
      if (error) throw error;
      toast.success("Profile updated!");
      setEditing(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const initials = (profile.firstName[0] || "") + (profile.lastName[0] || "");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex size-16 sm:size-20 shrink-0 items-center justify-center rounded-full text-xl sm:text-2xl font-display font-bold bg-primary text-primary-foreground">
          {initials || "?"}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-display font-semibold text-foreground truncate">
            {profile.firstName} {profile.lastName}
          </h3>
          <p className="text-sm text-muted-foreground truncate">{profile.email}</p>
        </div>
        <Button variant={editing ? "default" : "outline"} size="sm" onClick={() => editing ? handleSave() : setEditing(true)} disabled={saving} className="shrink-0">
          {saving ? <RefreshCcw className="size-4 animate-spin mr-1" /> : editing ? <Save className="size-4 mr-1" /> : null}
          {editing ? "Save" : "Edit"}
        </Button>
      </div>

      <Separator />

      <div>
        <SectionHeader title="Personal Information" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">First Name</label>
            <Input value={profile.firstName} disabled={!editing} onChange={e => setProfile(p => ({ ...p, firstName: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Last Name</label>
            <Input value={profile.lastName} disabled={!editing} onChange={e => setProfile(p => ({ ...p, lastName: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground flex items-center gap-2">
              Email <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">Cannot be changed</span>
            </label>
            <Input value={profile.email} disabled className="opacity-60" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Phone</label>
            <Input value={profile.phone} disabled={!editing} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} placeholder="+234 801 234 5678" />
          </div>
        </div>
        <div className="mt-4 space-y-1.5">
          <label className="text-sm font-medium text-foreground">Bio / Role</label>
          <Input value={profile.bio} disabled={!editing} onChange={e => setProfile(p => ({ ...p, bio: e.target.value }))} placeholder="e.g. Real Estate Agent" />
        </div>
      </div>

      <Separator />

      <div>
        <SectionHeader title="Location" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Country</label>
            <Input value={profile.country} disabled={!editing} onChange={e => setProfile(p => ({ ...p, country: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">City</label>
            <Input value={profile.city} disabled={!editing} onChange={e => setProfile(p => ({ ...p, city: e.target.value }))} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SecurityTab() {
  const [twoFA, setTwoFA] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [googleLinked, setGoogleLinked] = useState(false);
  const [checkingGoogle, setCheckingGoogle] = useState(true);

  useEffect(() => {
    const checkGoogle = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const identities = user.identities || [];
          setGoogleLinked(identities.some(i => i.provider === "google"));
        }
      } catch {}
      setCheckingGoogle(false);
    };
    checkGoogle();
  }, []);

  const handlePasswordChange = async () => {
    if (newPw !== confirmPw) { toast.error("Passwords don't match"); return; }
    if (newPw.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    setSavingPw(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;
      toast.success("Password updated!");
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } catch (err: any) {
      toast.error(err.message || "Failed to update password");
    } finally { setSavingPw(false); }
  };

  const handleGoogleLink = async () => {
    const { error } = await supabase.auth.linkIdentity({ provider: "google", options: { redirectTo: window.location.href } });
    if (error) toast.error(error.message);
  };

  const handleGoogleUnlink = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const googleIdentity = user?.identities?.find(i => i.provider === "google");
      if (!googleIdentity) { toast.error("No Google account linked"); return; }
      const { error } = await supabase.auth.unlinkIdentity(googleIdentity);
      if (error) throw error;
      setGoogleLinked(false);
      toast.success("Google account unlinked");
    } catch (err: any) {
      toast.error(err.message || "Failed to unlink Google");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <SectionHeader title="Change Password" />
        <div className="space-y-3">
          <PasswordInput label="Current Password" placeholder="Enter current password" value={currentPw} onChange={setCurrentPw} />
          <PasswordInput label="New Password" placeholder="Enter new password" value={newPw} onChange={setNewPw} />
          <PasswordInput label="Confirm New Password" placeholder="Confirm new password" value={confirmPw} onChange={setConfirmPw} />
        </div>
        <Button className="mt-4" onClick={handlePasswordChange} disabled={savingPw || !newPw || !confirmPw}>
          {savingPw ? <RefreshCcw className="size-4 animate-spin mr-1" /> : <Save className="size-4 mr-1" />}
          Update Password
        </Button>
      </div>

      <Separator />

      <div>
        <SectionHeader title="Linked Accounts" description="Connect external accounts for easier sign-in." />
        <SettingRow label="Google Account" description={googleLinked ? "Your Google account is connected" : "Link your Google account for SSO sign-in"}>
          {checkingGoogle ? (
            <RefreshCcw className="size-4 animate-spin text-muted-foreground" />
          ) : googleLinked ? (
            <Button variant="outline" size="sm" onClick={handleGoogleUnlink} className="gap-1.5 text-red-500 hover:text-red-600 hover:bg-red-500/10">
              <Unlink2 className="size-3.5" /> Unlink
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={handleGoogleLink} className="gap-1.5">
              <Link2 className="size-3.5" /> Link Google
            </Button>
          )}
        </SettingRow>
      </div>

      <Separator />

      <div>
        <SectionHeader title="Two-Factor Authentication" description="Add an extra layer of security." />
        <SettingRow label="Enable 2FA" description="Coming soon">
          <ToggleSwitch checked={twoFA} onChange={setTwoFA} disabled />
        </SettingRow>
      </div>

      <Separator />

      <div>
        <SectionHeader title="Active Sessions" description="Manage devices where you are logged in." />
        <div className="space-y-2">
          {[
            { device: "Current Browser", location: "This device", current: true },
          ].map((s) => (
            <SettingRow key={s.device} label={s.device} description={`${s.location}${s.current ? " — Current session" : ""}`}>
              {!s.current && <Button variant="outline" size="sm">Revoke</Button>}
              {s.current && <span className="text-xs text-green-500 font-medium flex items-center gap-1"><CheckCircle2 className="size-3" /> Active</span>}
            </SettingRow>
          ))}
        </div>
      </div>
    </div>
  );
}

function NotificationsTab() {
  const [notifs, setNotifs] = useState({
    email: true, inApp: true, scraper: false, newProperty: true, savedSearch: false,
  });

  const toggles: { key: keyof typeof notifs; label: string; description: string }[] = [
    { key: "email", label: "Email Notifications", description: "Receive important updates via email." },
    { key: "inApp", label: "In-App Notifications", description: "Get notified inside the application." },
    { key: "scraper", label: "Scraper Alerts", description: "Be notified when scraping jobs complete or fail." },
    { key: "newProperty", label: "New Property Alerts", description: "Get alerts when new properties are added." },
    { key: "savedSearch", label: "Saved Search Alerts", description: "Notified when new listings match saved searches." },
  ];

  const handleSave = () => { localStorage.setItem("rp-notif-prefs", JSON.stringify(notifs)); toast.success("Notification preferences saved!"); };

  return (
    <div className="space-y-4">
      <SectionHeader title="Notification Preferences" />
      <div className="space-y-2">
        {toggles.map(t => (
          <SettingRow key={t.key} label={t.label} description={t.description}>
            <ToggleSwitch checked={notifs[t.key]} onChange={v => setNotifs(p => ({ ...p, [t.key]: v }))} />
          </SettingRow>
        ))}
      </div>
      <Button onClick={handleSave} className="gap-1.5"><Save className="size-4" /> Save Preferences</Button>
    </div>
  );
}

import { useThemeConfig } from "@/components/theme-config-provider";

function PreferencesTab() {
  const { theme, setTheme } = useTheme();
  const { primaryLight, primaryDark, setPrimaryLight, setPrimaryDark, fontDisplay, setFontDisplay, fontBody, setFontBody, resetTheme } = useThemeConfig();
  const FONTS = ["Space Grotesk", "Outfit", "Inter", "Roboto", "Poppins", "Montserrat", "Open Sans", "Lato", "Plus Jakarta Sans"];

  const handleSave = () => { toast.success("Appearance settings are saved automatically."); };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-4">
          <SectionHeader title="Appearance" description="Customize how the app looks." />
          <Button variant="outline" size="sm" onClick={resetTheme}>Reset</Button>
        </div>

        <div className="space-y-6 bg-secondary/20 p-4 sm:p-5 rounded-xl border border-border/50">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Base Theme</label>
            <div className="flex gap-2">
              {[{ value: "light", label: "Light", Icon: Sun }, { value: "dark", label: "Dark", Icon: Moon }, { value: "system", label: "System", Icon: Monitor }].map(({ value, label, Icon }) => (
                <Button key={value} variant={theme === value ? "default" : "outline"} size="sm" onClick={() => setTheme(value)} className="gap-1.5 flex-1">
                  <Icon className="size-4" /> {label}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Display Font</label>
              <Select value={fontDisplay} onValueChange={setFontDisplay}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{FONTS.map(f => <SelectItem key={f} value={f} style={{ fontFamily: `"${f}", sans-serif` }}>{f}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Body Font</label>
              <Select value={fontBody} onValueChange={setFontBody}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{FONTS.map(f => <SelectItem key={f} value={f} style={{ fontFamily: `"${f}", sans-serif` }}>{f}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="pt-3 border-t border-border/50">
            <label className="text-sm font-medium text-foreground block mb-3">Brand Colors</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Light Mode Primary</p>
                <div className="flex items-center gap-2">
                  <input type="color" value={primaryLight} onChange={e => setPrimaryLight(e.target.value)} className="w-10 h-10 rounded border-0 cursor-pointer p-0 bg-transparent" />
                  <Input value={primaryLight} onChange={e => setPrimaryLight(e.target.value)} className="font-mono text-xs uppercase" />
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Dark Mode Primary</p>
                <div className="flex items-center gap-2">
                  <input type="color" value={primaryDark} onChange={e => setPrimaryDark(e.target.value)} className="w-10 h-10 rounded border-0 cursor-pointer p-0 bg-transparent" />
                  <Input value={primaryDark} onChange={e => setPrimaryDark(e.target.value)} className="font-mono text-xs uppercase" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Button onClick={handleSave} className="gap-1.5"><Save className="size-4" /> Save Appearance</Button>
    </div>
  );
}

function DataDisplayTab() {
  const [mapProvider, setMapProvider] = useState("osm");
  const [perPage, setPerPage] = useState("24");
  const [sortOrder, setSortOrder] = useState("newest");
  const [autoSubmitVoice, setAutoSubmitVoice] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("realtors_auto_submit_voice");
    if (saved) setAutoSubmitVoice(saved === "true");
    const savedMap = localStorage.getItem("map-provider-storage");
    if (savedMap) { try { const p = JSON.parse(savedMap); if (p?.state?.provider) setMapProvider(p.state.provider); } catch {} }
    const savedPerPage = localStorage.getItem("rp-per-page");
    if (savedPerPage) setPerPage(savedPerPage);
    const savedSort = localStorage.getItem("rp-sort-order");
    if (savedSort) setSortOrder(savedSort);
  }, []);

  const handleSave = () => {
    localStorage.setItem("realtors_auto_submit_voice", autoSubmitVoice.toString());
    localStorage.setItem("rp-per-page", perPage);
    localStorage.setItem("rp-sort-order", sortOrder);
    toast.success("Display settings saved!");
  };

  return (
    <div className="space-y-6">
      <SectionHeader title="Map Provider" description="Select the map service used across the application." />
      <SettingRow label="Provider" description="OpenStreetMap is free and doesn't require API keys">
        <Select value={mapProvider} onValueChange={setMapProvider}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="osm">OpenStreetMap</SelectItem>
            <SelectItem value="mapbox">Mapbox</SelectItem>
            <SelectItem value="google">Google Maps</SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>

      <Separator />

      <SectionHeader title="Properties" />
      <div className="space-y-2">
        <SettingRow label="Per Page" description="Number of property listings per page">
          <Select value={perPage} onValueChange={setPerPage}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["12", "24", "48", "96"].map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow label="Default Sort" description="How listings are ordered by default">
          <Select value={sortOrder} onValueChange={setSortOrder}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
              <SelectItem value="price-asc">Price: Low → High</SelectItem>
              <SelectItem value="price-desc">Price: High → Low</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
      </div>

      <Separator />

      <SectionHeader title="Voice Search" />
      <SettingRow label="Auto-Submit" description="Automatically submit when you finish speaking">
        <ToggleSwitch checked={autoSubmitVoice} onChange={setAutoSubmitVoice} />
      </SettingRow>

      <Button onClick={handleSave} className="gap-1.5"><Save className="size-4" /> Save Settings</Button>
    </div>
  );
}

function EmailSettingsTab() {
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("Realtors' Practice");

  const handleSave = () => { toast.success("Email settings saved! (Backend integration pending)"); };

  return (
    <div className="space-y-6">
      <SectionHeader title="SMTP Configuration" description="Configure outgoing email server for notifications and alerts." />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">SMTP Host</label>
          <Input value={smtpHost} onChange={e => setSmtpHost(e.target.value)} placeholder="smtp.resend.com" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">SMTP Port</label>
          <Input value={smtpPort} onChange={e => setSmtpPort(e.target.value)} placeholder="587" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Username</label>
          <Input value={smtpUser} onChange={e => setSmtpUser(e.target.value)} placeholder="resend" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Password / API Key</label>
          <Input type="password" value={smtpPass} onChange={e => setSmtpPass(e.target.value)} placeholder="re_..." />
        </div>
      </div>

      <Separator />

      <SectionHeader title="Sender Information" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">From Email</label>
          <Input value={fromEmail} onChange={e => setFromEmail(e.target.value)} placeholder="noreply@realtorspractice.com" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">From Name</label>
          <Input value={fromName} onChange={e => setFromName(e.target.value)} placeholder="Realtors' Practice" />
        </div>
      </div>

      <Separator />

      <SectionHeader title="Email Templates" description="Configure templates for different notification types." />
      <div className="space-y-2">
        {["New Property Alert", "Saved Search Match", "Scraper Job Complete", "Welcome Email", "Password Reset"].map(t => (
          <SettingRow key={t} label={t} description="Default template">
            <Button variant="outline" size="sm" disabled>Edit Template</Button>
          </SettingRow>
        ))}
      </div>

      <Button onClick={handleSave} className="gap-1.5"><Save className="size-4" /> Save Email Settings</Button>
    </div>
  );
}

function BackupTab() {
  const [backups] = useState<{ id: string; date: string; size: string; type: string }[]>([]);
  const [autoBackup, setAutoBackup] = useState(false);
  const [backupFreq, setBackupFreq] = useState("weekly");

  const handleCreateBackup = () => { toast.success("Manual backup initiated! (Backend integration pending)"); };
  const handleSave = () => { toast.success("Backup settings saved!"); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionHeader title="Data Backups" description="Create and manage database backups." />
        <Button onClick={handleCreateBackup} className="gap-1.5 shrink-0">
          <Plus className="size-4" /> Create Backup
        </Button>
      </div>

      <div className="space-y-2">
        <SettingRow label="Automatic Backups" description="Schedule regular automated backups">
          <ToggleSwitch checked={autoBackup} onChange={setAutoBackup} />
        </SettingRow>
        {autoBackup && (
          <SettingRow label="Frequency" description="How often to run automatic backups">
            <Select value={backupFreq} onValueChange={setBackupFreq}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>
        )}
      </div>

      <Separator />

      <SectionHeader title="Backup History" />
      {backups.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground border border-dashed rounded-lg">
          <HardDrive className="size-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No backups yet</p>
          <p className="text-xs mt-1">Create your first backup to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {backups.map(b => (
            <SettingRow key={b.id} label={`${b.type} Backup`} description={`${b.date} • ${b.size}`}>
              <div className="flex gap-2">
                <Button variant="outline" size="sm"><Download className="size-3.5" /></Button>
                <Button variant="outline" size="sm" className="text-red-500"><Trash2 className="size-3.5" /></Button>
              </div>
            </SettingRow>
          ))}
        </div>
      )}

      <Button onClick={handleSave} className="gap-1.5"><Save className="size-4" /> Save Backup Settings</Button>
    </div>
  );
}

function AboutTab() {
  const info = [
    { label: "App Name", value: "Realtors' Practice" },
    { label: "Version", value: "3.0.0" },
    { label: "Developed By", value: "WDC Solutions Hub" },
    { label: "Frontend", value: "Next.js 16 / React 19" },
    { label: "Backend", value: "Node.js / Express / Prisma" },
    { label: "Database", value: "CockroachDB" },
    { label: "Search Engine", value: "Meilisearch" },
    { label: "Scraper", value: "Python / Playwright / Celery" },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader title="Application Information" description="Details about this installation." />
      <div className="space-y-1">
        {info.map(item => (
          <SettingRow key={item.label} label={item.label}><span className="text-sm text-muted-foreground">{item.value}</span></SettingRow>
        ))}
      </div>
      <Separator />
      <p className="text-xs text-muted-foreground leading-relaxed">
        Realtors&apos; Practice is a comprehensive Nigerian property intelligence platform providing automated scraping, data validation, enrichment, advanced search, and analytics for real estate listings across Nigeria.
      </p>
    </div>
  );
}

function EnvConfigTab() {
  const [rawEnv, setRawEnv] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchEnv(); }, []);

  const fetchEnv = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("realtors_token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/env`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setRawEnv(data.data.raw);
      else toast.error(data.message || "Failed to load env vars");
    } catch (err: any) { toast.error(err.message || "Error connecting to server"); }
    finally { setLoading(false); }
  };

  const saveEnv = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem("realtors_token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/env`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rawContent: rawEnv })
      });
      const data = await res.json();
      if (data.success) toast.success(data.message || "Environment variables saved.");
      else toast.error(data.message || "Failed to save");
    } catch (err: any) { toast.error(err.message || "Error saving"); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4 flex flex-col" style={{ minHeight: "500px" }}>
      <SectionHeader title="Environment Variables" description="Modify server-side and client-side secrets. Use caution — syntax errors may break the platform." />
      <div className="flex-1 min-h-0 relative">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">Loading...</div>
        ) : (
          <textarea value={rawEnv} onChange={e => setRawEnv(e.target.value)}
            className="w-full h-full min-h-[400px] p-4 font-mono text-sm bg-zinc-950 text-emerald-400 rounded-lg border focus:ring-primary resize-none"
            spellCheck={false} placeholder="DATABASE_URL=..." />
        )}
      </div>
      <Button onClick={saveEnv} disabled={loading || saving} className="gap-1.5 self-end">
        {saving ? <RefreshCcw className="size-4 animate-spin" /> : <Save className="size-4" />}
        {saving ? "Saving..." : "Save Configuration"}
      </Button>
    </div>
  );
}

function UserAdminTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("realtors_token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setUsers(data.data);
    } catch { toast.error("Failed to fetch users"); }
    finally { setLoading(false); }
  };

  const updateRole = async (id: string, newRole: string) => {
    try {
      const token = localStorage.getItem("realtors_token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/${id}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role: newRole })
      });
      const data = await res.json();
      if (data.success) { toast.success(`Role updated to ${newRole}`); fetchUsers(); }
      else toast.error(data.message || "Failed to update role");
    } catch { toast.error("Error updating role"); }
  };

  return (
    <div className="space-y-6">
      <SectionHeader title="User Management" description="Manage user roles and approve pending admins." />
      <div className="rounded-lg border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Loading users...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">User</th>
                  <th className="px-4 py-3 text-left font-medium">Role</th>
                  <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">Joined</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map(u => (
                  <tr key={u.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{u.firstName} {u.lastName}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${u.role === 'ADMIN' ? 'bg-primary/10 text-primary' : u.role === 'PENDING_ADMIN' ? 'bg-amber-500/10 text-amber-500' : 'bg-muted text-muted-foreground'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right">
                      <Select value={u.role} onValueChange={val => updateRole(u.id, val)}>
                        <SelectTrigger className="w-[130px] h-8 ml-auto"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ADMIN">Admin</SelectItem>
                          <SelectItem value="PENDING_ADMIN">Pending</SelectItem>
                          <SelectItem value="EDITOR">Editor</SelectItem>
                          <SelectItem value="VIEWER">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No users found.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Settings Page
// ---------------------------------------------------------------------------

const TAB_COMPONENTS: Record<TabId, React.FC> = {
  profile: ProfileTab,
  security: SecurityTab,
  notifications: NotificationsTab,
  preferences: PreferencesTab,
  data: DataDisplayTab,
  email: EmailSettingsTab,
  backup: BackupTab,
  about: AboutTab,
  env: EnvConfigTab,
  users: UserAdminTab,
};

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const checkRole = async () => {
      try {
        const token = localStorage.getItem("realtors_token");
        if (!token) return;
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (data.success && data.data?.role === "ADMIN") setIsAdmin(true);
      } catch {}
    };
    checkRole();
  }, []);

  // On desktop, default to profile tab
  useEffect(() => {
    if (!isMobile && activeTab === null) setActiveTab("profile");
  }, [isMobile, activeTab]);

  const visibleTabs = TABS.filter(t => !t.adminOnly || isAdmin);
  const ActivePanel = activeTab ? TAB_COMPONENTS[activeTab] : null;
  const activeTabDef = visibleTabs.find(t => t.id === activeTab);

  // Mobile: show tab list or tab content (like the screenshot — each tab = full page)
  if (isMobile) {
    if (activeTab && ActivePanel) {
      return (
        <div className="min-h-screen">
          {/* Mobile header with back button */}
          <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border-border px-4 py-3 flex items-center gap-3">
            <button onClick={() => setActiveTab(null)} className="p-2 -ml-2 rounded-lg hover:bg-secondary transition-colors">
              <ArrowLeft className="size-5 text-foreground" />
            </button>
            <h2 className="font-display font-bold text-foreground">{activeTabDef?.label}</h2>
          </div>
          <div className="p-4">
            <ActivePanel />
          </div>
        </div>
      );
    }

    // Mobile tab list (like the screenshot design)
    return (
      <div className="px-4 py-6 space-y-6">
        {/* Profile card at top */}
        <div className="flex items-center gap-4">
          <div className="flex size-16 shrink-0 items-center justify-center rounded-full text-xl font-display font-bold bg-primary text-primary-foreground">
            ?
          </div>
          <div>
            <h2 className="text-lg font-display font-bold text-foreground">Settings</h2>
            <p className="text-sm text-muted-foreground">Manage your account</p>
          </div>
        </div>

        {/* Tab list */}
        <div className="space-y-1.5">
          {visibleTabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-border/50 hover:bg-secondary/50 transition-colors text-left group"
              >
                <div className="w-10 h-10 rounded-xl bg-secondary/50 flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                  <Icon className="size-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{tab.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{tab.description}</p>
                </div>
                <ChevronRight className="size-4 text-muted-foreground/50 shrink-0" />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Desktop: sidebar + content
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your account settings and preferences.</p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <nav className="w-56 shrink-0">
          <Card className="p-2">
            <ul className="space-y-0.5">
              {visibleTabs.map(tab => {
                const isActive = activeTab === tab.id;
                const Icon = tab.icon;
                return (
                  <li key={tab.id}>
                    <button onClick={() => setActiveTab(tab.id)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'}`}>
                      <Icon className="size-4 shrink-0" />
                      {tab.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
        </nav>

        {/* Content */}
        <Card className="min-w-0 flex-1 p-6">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="font-display">{activeTabDef?.label}</CardTitle>
            <CardDescription>{activeTabDef?.description}</CardDescription>
          </CardHeader>
          <Separator className="mb-6" />
          <CardContent className="p-0">
            {ActivePanel && <ActivePanel />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
