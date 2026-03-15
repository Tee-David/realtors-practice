"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { auth, users as usersApi } from "@/lib/api";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { usePersistedState } from "@/hooks/use-persisted-state";
import {
  User, Lock, Bell, Palette, LayoutDashboard, Mail, Database,
  Info, Users, ChevronRight, ChevronLeft, Upload, Eye, EyeOff,
  ToggleLeft, ToggleRight, Map, Monitor, Server, Download, RefreshCw,
  Trash2, Plus, Check, X, Link, ExternalLink, Shield, Terminal,
  AlertTriangle, HardDrive, Chrome, Smartphone, ChevronDown,
} from "lucide-react";
import { EmailTemplateBuilder } from "@/components/dashboard/email-template-builder";
import { useThemeConfig } from "@/components/theme-config-provider";
import { useTheme } from "next-themes";
import dynamic from "next/dynamic";
const Lanyard = dynamic(() => import("@/components/ui/lanyard"), {
  ssr: false,
  loading: () => <div className="w-full h-64 flex items-center justify-center text-muted-foreground text-sm">Loading 3D preview...</div>,
});
import AnimatedList from "@/components/ui/animated-list";

// ─── Types ─────────────────────────────────────────────────────────────────

type SettingsSection =
  | "profile" | "security" | "notifications" | "appearance"
  | "display" | "email" | "backups" | "about" | "users";

interface NavItem { key: SettingsSection; label: string; icon: React.ElementType; desc: string; danger?: boolean }

// ─── Nav Items ──────────────────────────────────────────────────────────────

const NAV: NavItem[] = [
  { key: "profile",       label: "Profile",           icon: User,          desc: "Personal details and avatar" },
  { key: "security",      label: "Security",          icon: Shield,        desc: "Password and account access" },
  { key: "notifications", label: "Notifications",     icon: Bell,          desc: "Email and in-app alerts" },
  { key: "appearance",    label: "Appearance",        icon: Palette,       desc: "Theme, fonts, and layout" },
  { key: "display",       label: "Data & Display",    icon: LayoutDashboard, desc: "Map, filters, and preferences" },
  { key: "email",         label: "Email Settings",    icon: Mail,          desc: "SMTP, templates, and delivery" },
  { key: "backups",       label: "Backups",           icon: Database,      desc: "Backup and restore data" },
  { key: "about",         label: "About",             icon: Info,          desc: "Version, credits, and legal" },
  { key: "users",         label: "Users",             icon: Users,         desc: "Manage team members and roles" },
];

// ─── Shared UI ──────────────────────────────────────────────────────────────

const inputBase = "w-full rounded-xl border px-3 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--primary)]";
const inputStyle = { backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" };

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border p-6 ${className}`} style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
      {children}
    </div>
  );
}

function CardHeader({ icon: Icon, title, action, children }: { icon: React.ElementType; title: string; action?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(0,1,252,0.08)" }}>
            <Icon className="w-5 h-5" style={{ color: "var(--primary)" }} />
          </div>
          <h3 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function SaveBtn({ isLoading, onClick, className = "mt-4" }: { isLoading?: boolean; onClick?: () => void; className?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className={`${className} px-5 py-2 rounded-xl text-sm font-semibold transition-colors hover:opacity-90 disabled:opacity-50`}
      style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
    >
      {isLoading ? "Saving…" : "Save Changes"}
    </button>
  );
}

function Toggle({ checked, onChange, label, sub }: { checked: boolean; onChange: () => void; label: string; sub?: string }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <div>
        <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{label}</p>
        {sub && <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{sub}</p>}
      </div>
      <button onClick={onChange} className="transition-colors shrink-0 ml-4" style={{ color: checked ? "#16a34a" : "var(--muted-foreground)" }}>
        {checked ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7" />}
      </button>
    </div>
  );
}

// ─── Searchable Select ───────────────────────────────────────────────────────

function SearchableSelect({ value, onChange, options, placeholder }: { value: string, onChange: (v: string) => void, options: string[], placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  
  const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));
  
  return (
    <div className="relative">
      <button 
        type="button" 
        onClick={() => setOpen(!open)} 
        className={inputBase + " flex justify-between items-center"} 
        style={inputStyle}
      >
        {value || placeholder}
        <ChevronDown className="w-4 h-4 opacity-50" />
      </button>
      
      {open && (
         <>
           <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
           <div className="absolute top-full mt-1 w-full bg-[var(--card)] border shadow-xl rounded-xl z-50 overflow-hidden" style={{ borderColor: 'var(--border)' }}>
             <div className="p-2 border-b" style={{ borderColor: 'var(--border)' }}>
               <input 
                 autoFocus
                 className="w-full px-2 py-1 text-sm bg-[var(--background)] border rounded text-[var(--foreground)] focus:outline-none" 
                 style={{ borderColor: 'var(--border)' }}
                 placeholder="Search fonts..."
                 value={search}
                 onChange={e => setSearch(e.target.value)}
               />
             </div>
             <div className="max-h-48 overflow-y-auto p-1">
                {filtered.map(opt => (
                  <button 
                    key={opt}
                    type="button"
                    onClick={() => { onChange(opt); setOpen(false); setSearch(""); }}
                    className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-[var(--secondary)] transition-colors"
                  >
                    {opt}
                  </button>
                ))}
             </div>
           </div>
         </>
      )}
    </div>
  )
}

// ─── Profile ────────────────────────────────────────────────────────────────

function ProfileSection() {
  const queryClient = useQueryClient();
  const { data: me } = useQuery({ queryKey: ["auth-me"], queryFn: async () => (await auth.me()).data.data });
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [company, setCompany] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (me && firstName === "" && !editing) {
      setFirstName(me.firstName || "");
      setLastName(me.lastName || "");
      setPhone(me.phone || "");
      setBio(me.bio || "");
      setCompany(me.company || "");
    }
  }, [me, firstName, editing]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB"); return; }

    try {
      setUploadingAvatar(true);
      // Resize and convert to base64 data URL — stored directly in DB
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement("canvas");
            const size = 200; // 200x200 avatar
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext("2d")!;
            const scale = Math.max(size / img.width, size / img.height);
            const x = (size - img.width * scale) / 2;
            const y = (size - img.height * scale) / 2;
            ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
            resolve(canvas.toDataURL("image/jpeg", 0.8));
          };
          img.onerror = reject;
          img.src = reader.result as string;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      await auth.updateProfile({ avatarUrl: dataUrl });
      queryClient.invalidateQueries({ queryKey: ["auth-me"] });
      toast.success("Avatar updated");
    } catch (err: any) {
      toast.error(err?.message || "Failed to upload avatar");
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Avatar */}
      <Card>
        <CardHeader icon={User} title="My Profile" action={
          <button onClick={() => setEditing(e => !e)} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors hover:bg-[var(--secondary)]" style={{ borderColor: "var(--border)", color: "var(--foreground)" }}>
            {editing ? <X className="w-3 h-3" /> : null} {editing ? "Cancel" : "Edit ✎"}
          </button>
        }>
          <div className="flex items-center gap-5">
            <div className="relative">
              {me?.avatarUrl ? (
                <img src={me.avatarUrl} alt="Avatar" className="w-20 h-20 rounded-2xl object-cover" />
              ) : (
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-bold" style={{ backgroundColor: "rgba(0,1,252,0.1)", color: "var(--primary)" }}>
                  {(me?.firstName?.[0] || me?.email?.[0] || "U").toUpperCase()}
                </div>
              )}
              {editing && (
                <>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full border-2 flex items-center justify-center"
                    style={{ backgroundColor: "var(--primary)", borderColor: "var(--card)", color: "var(--primary-foreground)" }}
                  >
                    {uploadingAvatar ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                  </button>
                </>
              )}
            </div>
            <div>
              <p className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>{me?.firstName} {me?.lastName}</p>
              <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{me?.role || "Admin"}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{me?.email}</p>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Personal Info */}
      <Card>
        <CardHeader icon={User} title="Personal Information" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { label: "First Name", val: firstName, set: setFirstName },
            { label: "Last Name",  val: lastName,  set: setLastName },
          ].map(f => (
            <div key={f.label}>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted-foreground)" }}>{f.label}</label>
              <input value={f.val} onChange={e => f.set(e.target.value)} disabled={!editing} className={inputBase + (editing ? "" : " opacity-70")} style={inputStyle} />
            </div>
          ))}
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted-foreground)" }}>Email <span className="text-[10px] rounded px-1.5 py-0.5 ml-1" style={{ backgroundColor: "var(--secondary)" }}>Locked</span></label>
            <input value={me?.email || ""} disabled className={inputBase + " opacity-50 cursor-not-allowed"} style={inputStyle} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted-foreground)" }}>Phone</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} disabled={!editing} className={inputBase + (editing ? "" : " opacity-70")} style={inputStyle} placeholder="+234..." />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted-foreground)" }}>Company</label>
            <input value={company} onChange={e => setCompany(e.target.value)} disabled={!editing} className={inputBase + (editing ? "" : " opacity-70")} style={inputStyle} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted-foreground)" }}>Bio</label>
            <textarea value={bio} onChange={e => setBio(e.target.value)} disabled={!editing} rows={2} className={inputBase + (editing ? "" : " opacity-70") + " resize-none"} style={inputStyle} />
          </div>
        </div>
        {editing && <SaveBtn isLoading={saving} onClick={async () => {
          try {
            setSaving(true);
            await auth.updateProfile({ firstName, lastName, phone, bio, company });
            queryClient.invalidateQueries({ queryKey: ["auth-me"] });
            toast.success("Profile saved");
            setEditing(false);
          } catch (err: any) {
            toast.error(err?.response?.data?.message || "Failed to save profile");
          } finally {
            setSaving(false);
          }
        }} />}
      </Card>
    </div>
  );
}

// ─── Security ───────────────────────────────────────────────────────────────

function SecuritySection() {
  const [showNew, setShowNew] = useState(false);
  const [googleLinked, setGoogleLinked] = useState(false);
  const [googleLinking, setGoogleLinking] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [changingPw, setChangingPw] = useState(false);

  // Check if Google identity is already linked — also re-checks after OAuth redirect
  useEffect(() => {
    const checkGoogleLink = async () => {
      const { supabase } = await import("@/lib/supabase");
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.identities) {
        setGoogleLinked(user.identities.some((id: any) => id.provider === "google"));
      }
      setGoogleLinking(false);
    };
    checkGoogleLink();

    // Listen for auth state changes (covers returning from OAuth redirect)
    let sub: { unsubscribe: () => void } | undefined;
    (async () => {
      const { supabase } = await import("@/lib/supabase");
      const { data } = supabase.auth.onAuthStateChange(() => { checkGoogleLink(); });
      sub = data.subscription;
    })();
    return () => { sub?.unsubscribe(); };
  }, []);

  const handleGoogleLink = async () => {
    try {
      setGoogleLinking(true);
      const { supabase } = await import("@/lib/supabase");

      if (googleLinked) {
        // Unlink Google identity
        const { data: { user } } = await supabase.auth.getUser();
        const googleIdentity = user?.identities?.find((id: any) => id.provider === "google");
        if (googleIdentity) {
          const { error } = await supabase.auth.unlinkIdentity(googleIdentity);
          if (error) throw error;
          setGoogleLinked(false);
          toast.success("Google account unlinked");
        }
      } else {
        // Link Google identity — redirects to Google OAuth
        const { error } = await supabase.auth.linkIdentity({
          provider: "google",
          options: { redirectTo: `${window.location.origin}/settings` },
        });
        if (error) throw error;
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to update Google connection");
    } finally {
      setGoogleLinking(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!newPw || newPw.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (newPw !== confirmPw) {
      toast.error("Passwords do not match");
      return;
    }
    try {
      setChangingPw(true);
      const { supabase } = await import("@/lib/supabase");
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;
      toast.success("Password updated successfully");
      setNewPw(""); setConfirmPw("");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update password");
    } finally {
      setChangingPw(false);
    }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Password */}
      <Card>
        <CardHeader icon={Lock} title="Change Password" />
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted-foreground)" }}>New Password</label>
            <div className="relative">
              <input type={showNew ? "text" : "password"} value={newPw} onChange={e => setNewPw(e.target.value)} className={inputBase + " pr-10"} style={inputStyle} placeholder="••••••••" />
              <button type="button" onClick={() => setShowNew(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted-foreground)" }}>
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted-foreground)" }}>Confirm New Password</label>
            <div className="relative">
              <input type={showNew ? "text" : "password"} value={confirmPw} onChange={e => setConfirmPw(e.target.value)} className={inputBase + " pr-10"} style={inputStyle} placeholder="••••••••" />
            </div>
          </div>
        </div>
        <SaveBtn isLoading={changingPw} onClick={handlePasswordChange} />
      </Card>

      {/* Google */}
      <Card>
        <CardHeader icon={Link} title="Linked Accounts" />
        <div className="flex items-center justify-between p-3 rounded-xl border" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(234,88,12,0.08)" }}>
              <Chrome className="w-5 h-5" style={{ color: "#ea580c" }} />
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>Google</p>
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{googleLinked ? "Linked" : "Not connected"}</p>
            </div>
          </div>
          <button className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-50" style={{ borderColor: googleLinked ? "var(--destructive)" : "var(--primary)", color: googleLinked ? "var(--destructive)" : "var(--primary)" }}
            onClick={handleGoogleLink}
            disabled={googleLinking}
          >
            {googleLinking ? "Processing…" : googleLinked ? "Unlink" : "Connect"}
          </button>
        </div>
      </Card>

      {/* Sessions */}
      <Card>
        <CardHeader icon={Smartphone} title="Active Sessions" />
        {[
          { device: "Chrome on macOS", ip: "102.88.34.12", last: "Now", current: true },
          { device: "Safari on iPhone", ip: "102.88.34.45", last: "2h ago", current: false },
        ].map((s, i) => (
          <div key={i} className="flex items-center justify-between py-2.5 border-b last:border-0" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "var(--secondary)" }}>
                <Smartphone className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} />
              </div>
              <div>
                <p className="text-sm font-medium flex items-center gap-1.5" style={{ color: "var(--foreground)" }}>
                  {s.device}
                  {s.current && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ backgroundColor: "rgba(22,163,74,0.12)", color: "#16a34a" }}>Current</span>}
                </p>
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{s.ip} · {s.last}</p>
              </div>
            </div>
            {!s.current && (
              <button onClick={() => toast.success("Session revoked")} className="text-xs font-medium" style={{ color: "var(--destructive)" }}>Revoke</button>
            )}
          </div>
        ))}
      </Card>
    </div>
  );
}

// ─── Notifications ──────────────────────────────────────────────────────────

function NotificationsSection() {
  const [emailMatch, setEmailMatch] = usePersistedState("notif-email-match", true);
  const [emailScrape, setEmailScrape] = usePersistedState("notif-email-scrape", false);
  const [emailPriceDrop, setEmailPriceDrop] = usePersistedState("notif-email-price-drop", true);
  const [inAppMatch, setInAppMatch] = usePersistedState("notif-inapp-match", true);
  const [inAppPriceDrop, setInAppPriceDrop] = usePersistedState("notif-inapp-price-drop", true);
  const [inAppScrape, setInAppScrape] = usePersistedState("notif-inapp-scrape", true);
  const [quietHours, setQuietHours] = usePersistedState("notif-quiet-hours", false);
  const [digest, setDigest] = usePersistedState("notif-digest", "daily");

  return (
    <div className="space-y-4 max-w-2xl">
      <Card>
        <CardHeader icon={Mail} title="Email Notifications" />
        <AnimatedList 
          showGradients={false} 
          displayScrollbar={false}
          items={[
            <Toggle key="1" checked={emailMatch}     onChange={() => setEmailMatch(v => !v)}     label="New saved search matches" sub="Alerts when matching properties appear" />,
            <Toggle key="2" checked={emailPriceDrop} onChange={() => setEmailPriceDrop(v => !v)} label="Price drops" sub="Properties you've viewed drop in price" />,
            <Toggle key="3" checked={emailScrape}    onChange={() => setEmailScrape(v => !v)}    label="Scrape job completed" />
          ]} 
        />
        <div className="mt-4">
          <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted-foreground)" }}>Digest Frequency</label>
          <select value={digest} onChange={e => setDigest(e.target.value)} className={inputBase} style={inputStyle}>
            <option value="realtime">Real-time</option>
            <option value="daily">Daily digest</option>
            <option value="weekly">Weekly digest</option>
            <option value="never">Never</option>
          </select>
        </div>
      </Card>

      <Card>
        <CardHeader icon={Bell} title="In-App Notifications" />
        <AnimatedList 
          showGradients={false} 
          displayScrollbar={false}
          items={[
            <Toggle key="1" checked={inAppMatch}     onChange={() => setInAppMatch(v => !v)}     label="New property matches" />,
            <Toggle key="2" checked={inAppPriceDrop} onChange={() => setInAppPriceDrop(v => !v)} label="Price drops on watched properties" />,
            <Toggle key="3" checked={inAppScrape}    onChange={() => setInAppScrape(v => !v)}    label="Scrape completion alerts" />,
            <Toggle key="4" checked={quietHours}     onChange={() => setQuietHours(v => !v)}     label="Quiet hours (11pm–7am)" sub="Pause all notifications overnight" />
          ]} 
        />
      </Card>

      <button onClick={() => toast.success("Preferences saved")} className="px-5 py-2 rounded-xl text-sm font-semibold transition-colors hover:opacity-90" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>
        Save Preferences
      </button>
    </div>
  );
}

// ─── Appearance ─────────────────────────────────────────────────────────────

const GOOGLE_FONTS = [
  "Inter","Roboto","Open Sans","Montserrat","Lato",
  "Poppins","Outfit","Space Grotesk","Playfair Display","Merriweather", 
  "Nunito","Raleway","Ubuntu","Rubik","Work Sans"
];

function AppearanceSection() {
  const [theme, setTheme] = usePersistedState<"light" | "dark" | "system">("appearance-theme", "system");
  const [fontSize, setFontSize] = usePersistedState<"small" | "default" | "large">("appearance-font-size", "default");
  const [compact, setCompact] = usePersistedState("appearance-compact", false);
  const [sidebarExpanded, setSidebarExpanded] = usePersistedState("appearance-sidebar-expanded", true);

  const { primaryLight, primaryDark, fontDisplay, fontBody, setPrimaryLight, setPrimaryDark, setFontDisplay, setFontBody, resetTheme } = useThemeConfig();

  // Apply theme on mount and when changed
  useEffect(() => {
    if (theme === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.classList.toggle("dark", prefersDark);
    } else {
      document.documentElement.classList.toggle("dark", theme === "dark");
    }
  }, [theme]);

  // Apply font size on mount and when changed
  useEffect(() => {
    const size = fontSize === "small" ? "14px" : fontSize === "large" ? "18px" : "16px";
    document.documentElement.style.fontSize = size;
  }, [fontSize]);

  // Apply compact mode on mount and when changed
  useEffect(() => {
    document.body.classList.toggle("compact-mode", compact);
  }, [compact]);

  const themes = [
    { value: "light",  label: "Light",  icon: "☀️" },
    { value: "dark",   label: "Dark",   icon: "🌙" },
    { value: "system", label: "System", icon: "💻" },
  ];

  return (
    <div className="space-y-4 max-w-2xl">
      <Card>
        <CardHeader icon={Palette} title="Theme Mode" />
        <div className="grid grid-cols-3 gap-3">
          {themes.map(t => (
            <button key={t.value} onClick={() => setTheme(t.value as typeof theme)}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all"
              style={{ borderColor: theme === t.value ? "var(--primary)" : "var(--border)", backgroundColor: theme === t.value ? "rgba(0,1,252,0.06)" : "transparent" }}
            >
              <span className="text-2xl">{t.icon}</span>
              <span className="text-sm font-medium" style={{ color: theme === t.value ? "var(--primary)" : "var(--foreground)" }}>{t.label}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader icon={Palette} title="Colors & Fonts" action={
          <button onClick={resetTheme} className="text-xs font-semibold px-3 py-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors">Reset Defaults</button>
        } />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted-foreground)" }}>Primary Color (Light Mode)</label>
              <div className="flex gap-3 items-center">
                <input type="color" value={primaryLight} onChange={e => setPrimaryLight(e.target.value)} className="w-10 h-10 rounded cursor-pointer border-0 p-0" />
                <span className="text-sm font-medium font-mono" style={{ color: "var(--foreground)" }}>{primaryLight.toUpperCase()}</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted-foreground)" }}>Primary Color (Dark Mode)</label>
              <div className="flex gap-3 items-center">
                <input type="color" value={primaryDark} onChange={e => setPrimaryDark(e.target.value)} className="w-10 h-10 rounded cursor-pointer border-0 p-0" />
                <span className="text-sm font-medium font-mono" style={{ color: "var(--foreground)" }}>{primaryDark.toUpperCase()}</span>
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
             <div>
               <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted-foreground)" }}>Display Font (Headings)</label>
               <SearchableSelect value={fontDisplay} onChange={setFontDisplay} options={GOOGLE_FONTS} placeholder="Select font..." />
             </div>
             <div>
               <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted-foreground)" }}>Body Font (Text)</label>
               <SearchableSelect value={fontBody} onChange={setFontBody} options={GOOGLE_FONTS} placeholder="Select font..." />
             </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader icon={Monitor} title="Display Preferences" />
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: "var(--muted-foreground)" }}>Font Size</label>
            <div className="flex gap-2">
              {(["small", "default", "large"] as const).map(s => (
                <button key={s} onClick={() => setFontSize(s)}
                  className="px-4 py-2 rounded-xl border text-sm font-medium transition-all capitalize"
                  style={{ borderColor: fontSize === s ? "var(--primary)" : "var(--border)", backgroundColor: fontSize === s ? "rgba(0,1,252,0.07)" : "transparent", color: fontSize === s ? "var(--primary)" : "var(--muted-foreground)" }}
                >{s}</button>
              ))}
            </div>
          </div>
          <AnimatedList 
            showGradients={false} 
            displayScrollbar={false}
            items={[
              <Toggle key="1" checked={compact} onChange={() => setCompact(v => !v)} label="Compact mode" sub="Denser UI with smaller spacing" />,
              <Toggle key="2" checked={sidebarExpanded} onChange={() => setSidebarExpanded(v => !v)} label="Sidebar expanded by default" />
            ]} 
          />
        </div>
        <SaveBtn className="mt-4" onClick={() => toast.success("Appearance settings saved")} />
      </Card>
    </div>
  );
}

// ─── Data & Display ─────────────────────────────────────────────────────────

function DisplaySection() {
  const [mapProvider, setMapProvider] = usePersistedState("display-map-provider", "osm");
  const [mapKey, setMapKey] = usePersistedState("display-map-key", "");
  const [perPage, setPerPage] = usePersistedState("display-per-page", "20");
  const [defaultSort, setDefaultSort] = usePersistedState("display-default-sort", "createdAt");
  const [defaultType, setDefaultType] = usePersistedState("display-default-type", "");
  const [voiceAuto, setVoiceAuto] = usePersistedState("display-voice-auto", false);
  const [dateFormat, setDateFormat] = usePersistedState("display-date-format", "DD/MM/YYYY");

  const providers = [
    { key: "osm",    name: "OpenStreetMap", desc: "Free, open-source",              free: true },
    { key: "mapbox", name: "Mapbox GL",     desc: "Premium tiles, 3D. 50K loads/mo", free: false },
    { key: "google", name: "Google Maps",   desc: "Satellite + Street View",         free: false },
  ];

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Map Provider */}
      <Card>
        <CardHeader icon={Map} title="Map Provider" />
        <div className="space-y-2.5">
          {providers.map(p => (
            <button key={p.key} onClick={() => setMapProvider(p.key)}
              className="w-full flex items-center gap-4 p-3.5 rounded-xl border text-left transition-all"
              style={{ borderColor: mapProvider === p.key ? "var(--primary)" : "var(--border)", borderWidth: mapProvider === p.key ? 2 : 1, backgroundColor: mapProvider === p.key ? "rgba(0,1,252,0.04)" : "transparent" }}
            >
              <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0" style={{ borderColor: mapProvider === p.key ? "var(--primary)" : "var(--border)" }}>
                {mapProvider === p.key && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "var(--primary)" }} />}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{p.name}</span>
                  {p.free && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(22,163,74,0.12)", color: "#16a34a" }}>FREE</span>}
                </div>
                <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{p.desc}</p>
              </div>
            </button>
          ))}
        </div>
        {mapProvider !== "osm" && (
          <div className="mt-4">
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted-foreground)" }}>{mapProvider === "mapbox" ? "Mapbox" : "Google Maps"} API Key</label>
            <input type="password" value={mapKey} onChange={e => setMapKey(e.target.value)} className={inputBase} style={inputStyle} placeholder="Enter API key…" />
          </div>
        )}
      </Card>

      {/* Preferences */}
      <Card>
        <CardHeader icon={LayoutDashboard} title="Display Preferences" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted-foreground)" }}>Properties per page</label>
            <select value={perPage} onChange={e => setPerPage(e.target.value)} className={inputBase} style={inputStyle}>
              {["10","20","50","100"].map(v => <option key={v} value={v}>{v} properties</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted-foreground)" }}>Default sort</label>
            <select value={defaultSort} onChange={e => setDefaultSort(e.target.value)} className={inputBase} style={inputStyle}>
              <option value="createdAt">Newest first</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
              <option value="relevance">Most relevant</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted-foreground)" }}>Default listing type</label>
            <select value={defaultType} onChange={e => setDefaultType(e.target.value)} className={inputBase} style={inputStyle}>
              <option value="">All types</option>
              <option value="SALE">For Sale</option>
              <option value="RENT">For Rent</option>
              <option value="LEASE">Lease</option>
              <option value="SHORTLET">Shortlet</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted-foreground)" }}>Date format</label>
            <select value={dateFormat} onChange={e => setDateFormat(e.target.value)} className={inputBase} style={inputStyle}>
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
            </select>
          </div>
        </div>
        <div className="mt-4 divide-y" style={{ borderColor: "var(--border)" }}>
          <Toggle checked={voiceAuto} onChange={() => setVoiceAuto(v => !v)} label="Voice search auto-submit" sub="Auto-search when voice input pauses" />
        </div>
        <SaveBtn onClick={() => toast.success("Display preferences saved")} />
      </Card>
    </div>
  );
}

// ─── Email Settings ─────────────────────────────────────────────────────────

function EmailSection() {
  const [provider, setProvider] = usePersistedState<"smtp" | "resend">("email-provider", "resend");
  const [apiKey, setApiKey] = usePersistedState("email-api-key", "");
  const [smtpHost, setSmtpHost] = usePersistedState("smtp-host", "");
  const [smtpPort, setSmtpPort] = usePersistedState("smtp-port", "587");
  const [smtpUser, setSmtpUser] = usePersistedState("smtp-user", "");
  const [smtpPass, setSmtpPass] = usePersistedState("smtp-pass", "");
  const [fromEmail, setFromEmail] = usePersistedState("email-from", "");
  const [replyTo, setReplyTo] = usePersistedState("email-reply-to", "");
  const [testTo, setTestTo] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<{ name: string } | null>(null);

  const handleTestEmail = async () => {
    try {
      setSendingTest(true);
      await auth.testEmail(testTo || undefined);
      toast.success(`Test email sent to ${testTo || "your account email"}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to send test email. Check backend env vars: RESEND_API_KEY or SMTP_HOST/SMTP_USER/SMTP_PASS.");
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <Card>
        <CardHeader icon={Server} title="Email Provider" />
        <p className="text-xs mb-3" style={{ color: "var(--muted-foreground)" }}>
          Configure via backend environment variables: <code className="text-[10px] px-1 py-0.5 rounded" style={{ backgroundColor: "var(--secondary)" }}>RESEND_API_KEY</code> or <code className="text-[10px] px-1 py-0.5 rounded" style={{ backgroundColor: "var(--secondary)" }}>SMTP_HOST</code>, <code className="text-[10px] px-1 py-0.5 rounded" style={{ backgroundColor: "var(--secondary)" }}>SMTP_USER</code>, <code className="text-[10px] px-1 py-0.5 rounded" style={{ backgroundColor: "var(--secondary)" }}>SMTP_PASS</code>
        </p>
        <div className="flex gap-2 mb-4">
          {(["smtp", "resend"] as const).map(p => (
            <button key={p} onClick={() => setProvider(p)}
              className="px-4 py-2 rounded-xl border text-sm font-medium capitalize transition-all"
              style={{ borderColor: provider === p ? "var(--primary)" : "var(--border)", backgroundColor: provider === p ? "rgba(0,1,252,0.07)" : "transparent", color: provider === p ? "var(--primary)" : "var(--muted-foreground)" }}
            >{p === "smtp" ? "SMTP" : "Resend"}</button>
          ))}
        </div>
        <div className="space-y-3">
          {provider === "smtp" ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted-foreground)" }}>SMTP Host</label>
                <input value={smtpHost} onChange={e => setSmtpHost(e.target.value)} className={inputBase} style={inputStyle} placeholder="smtp.gmail.com" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted-foreground)" }}>Port</label>
                <input type="number" value={smtpPort} onChange={e => setSmtpPort(e.target.value)} className={inputBase} style={inputStyle} placeholder="587" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted-foreground)" }}>Username</label>
                <input value={smtpUser} onChange={e => setSmtpUser(e.target.value)} className={inputBase} style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted-foreground)" }}>Password</label>
                <input type="password" value={smtpPass} onChange={e => setSmtpPass(e.target.value)} className={inputBase} style={inputStyle} />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted-foreground)" }}>Resend API Key</label>
              <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} className={inputBase} style={inputStyle} placeholder="re_…" />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted-foreground)" }}>From Address</label>
              <input type="email" value={fromEmail} onChange={e => setFromEmail(e.target.value)} className={inputBase} style={inputStyle} placeholder="hello@yourapp.com" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted-foreground)" }}>Reply-To</label>
              <input type="email" value={replyTo} onChange={e => setReplyTo(e.target.value)} className={inputBase} style={inputStyle} placeholder="support@yourapp.com" />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-4 flex-wrap">
          <input type="email" value={testTo} onChange={e => setTestTo(e.target.value)} className={inputBase + " max-w-[200px]"} style={inputStyle} placeholder="Recipient email" />
          <button
            onClick={handleTestEmail}
            disabled={sendingTest}
            className="px-5 py-2 rounded-xl border text-sm font-semibold transition-colors hover:bg-[var(--secondary)] disabled:opacity-50"
            style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
          >
            {sendingTest ? "Sending..." : "Send Test Email"}
          </button>
        </div>
      </Card>

      {/* Templates */}
      <Card>
        <CardHeader icon={Mail} title="Email Templates" />
        <div className="space-y-2">
          {["Welcome", "Saved Search Match Alert", "Scrape Report", "Password Reset"].map(t => (
            <div key={t} className="flex items-center justify-between p-3 rounded-xl border transition-colors hover:bg-[var(--secondary)]" style={{ borderColor: "var(--border)" }}>
              <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{t}</span>
              <button className="text-xs font-medium" style={{ color: "var(--primary)" }} onClick={() => setEditingTemplate({ name: t })}>Edit ✎</button>
            </div>
          ))}
        </div>
      </Card>

      <EmailTemplateBuilder
        open={!!editingTemplate}
        templateName={editingTemplate?.name || ""}
        onClose={() => setEditingTemplate(null)}
        onSave={(html, design) => {
          toast.success(`${editingTemplate?.name} template saved`);
          setEditingTemplate(null);
        }}
      />
    </div>
  );
}

// ─── Backups ────────────────────────────────────────────────────────────────

function BackupsSection() {
  const [schedule, setSchedule] = useState("weekly");
  const [retention, setRetention] = useState("10");
  const mockBackups = [
    { id: "1", date: "2025-03-10 03:00", size: "42 MB", status: "success" },
    { id: "2", date: "2025-03-03 03:00", size: "39 MB", status: "success" },
    { id: "3", date: "2025-02-24 03:00", size: "37 MB", status: "failed" },
  ];

  return (
    <div className="space-y-4 max-w-2xl">
      <Card>
        <CardHeader icon={Database} title="Create Backup" />
        <p className="text-sm mb-4" style={{ color: "var(--muted-foreground)" }}>Manually trigger a full database backup. This may take a few minutes.</p>
        <button onClick={() => toast.loading("Backup started…")} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors hover:opacity-90" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>
          <HardDrive className="w-4 h-4" /> Create Backup Now
        </button>
      </Card>

      <Card>
        <CardHeader icon={RefreshCw} title="Automatic Backup Schedule" />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted-foreground)" }}>Schedule</label>
            <select value={schedule} onChange={e => setSchedule(e.target.value)} className={inputBase} style={inputStyle}>
              <option value="off">Disabled</option>
              <option value="daily">Daily (3 AM)</option>
              <option value="weekly">Weekly (Mon 3 AM)</option>
              <option value="monthly">Monthly (1st, 3 AM)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted-foreground)" }}>Keep last</label>
            <select value={retention} onChange={e => setRetention(e.target.value)} className={inputBase} style={inputStyle}>
              <option value="5">5 backups</option>
              <option value="10">10 backups</option>
              <option value="30">30 backups</option>
              <option value="unlimited">Unlimited</option>
            </select>
          </div>
        </div>
        <SaveBtn onClick={() => toast.success("Backup schedule saved")} />
      </Card>

      <Card>
        <CardHeader icon={HardDrive} title="Backup History" />
        <div className="space-y-2">
          {mockBackups.map(b => (
            <div key={b.id} className="flex items-center justify-between p-3 rounded-xl border" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: b.status === "success" ? "#16a34a" : "#dc2626" }} />
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{b.date}</p>
                  <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{b.size} · {b.status}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => toast.success("Downloading…")} className="p-1.5 rounded-lg hover:bg-[var(--secondary)]" title="Download"><Download className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} /></button>
                <button onClick={() => toast.info("Restore started")} className="p-1.5 rounded-lg hover:bg-[var(--secondary)]" title="Restore"><RefreshCw className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} /></button>
                <button onClick={() => toast.error("Backup deleted")} className="p-1.5 rounded-lg hover:bg-[var(--secondary)]" title="Delete"><Trash2 className="w-4 h-4" style={{ color: "var(--destructive)" }} /></button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── About ──────────────────────────────────────────────────────────────────

function AboutSection() {
  return (
    <div className="space-y-4 max-w-2xl">
      <Card>
        <CardHeader icon={Info} title="Application Info" />
        <div className="space-y-3">
          {[
            { label: "App Name",     value: "Realtors' Practice" },
            { label: "Version",      value: "v2.5.0" },
            { label: "Environment",  value: process.env.NODE_ENV || "production" },
            { label: "Database",     value: "PostgreSQL (CockroachDB)" },
            { label: "Search",       value: "Meilisearch" },
            { label: "Auth",         value: "Supabase" },
            { label: "Built by",     value: "WDC Solutions" },
          ].map(row => (
            <div key={row.label} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: "var(--border)" }}>
              <span className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>{row.label}</span>
              <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{row.value}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader icon={ExternalLink} title="Legal & Links" />
        <div className="space-y-2">
          {["Privacy Policy", "Terms of Service", "Cookie Policy"].map(l => (
            <button key={l} onClick={() => toast.info("Coming soon")} className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-[var(--secondary)] transition-colors" >
              <span className="text-sm" style={{ color: "var(--foreground)" }}>{l}</span>
              <ExternalLink className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} />
            </button>
          ))}
        </div>
      </Card>

    </div>
  );
}

// ─── Users ──────────────────────────────────────────────────────────────────

function UsersSection() {
  const queryClient = useQueryClient();
  const { data: me } = useQuery({ queryKey: ["auth-me"], queryFn: async () => (await auth.me()).data.data });
  const { data: usersData, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await usersApi.list();
      return res.data.data || [];
    },
  });

  // Invite modal state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFirstName, setInviteFirstName] = useState("");
  const [inviteLastName, setInviteLastName] = useState("");
  const [inviteRole, setInviteRole] = useState("VIEWER");
  const [inviting, setInviting] = useState(false);

  const handleInvite = async () => {
    if (!inviteEmail) {
      toast.error("Email is required");
      return;
    }
    try {
      setInviting(true);
      await auth.invite({
        email: inviteEmail,
        firstName: inviteFirstName || undefined,
        lastName: inviteLastName || undefined,
        role: inviteRole,
      });
      toast.success(`Invitation sent to ${inviteEmail}`);
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setInviteOpen(false);
      setInviteEmail(""); setInviteFirstName(""); setInviteLastName(""); setInviteRole("VIEWER");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to send invitation");
    } finally {
      setInviting(false);
    }
  };

  const updateRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => usersApi.updateRole(id, role),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["users"] }); toast.success("Role updated"); },
  });

  const toggleActive = useMutation({
    mutationFn: ({ id }: { id: string; isActive: boolean }) => usersApi.toggleActive(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["users"] }); },
  });

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to permanently delete this user?")) {
      toast.error("User deleted (Requires backend implementation)");
    }
  };

  const isSuperAdmin = me?.email === "wedigcreativity@gmail.com";
  const users = usersData || [];

  return (
    <div className="max-w-4xl">
      {/* Invite Modal */}
      {inviteOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setInviteOpen(false); }}>
          <div className="rounded-2xl border p-6 w-full max-w-md mx-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <h3 className="text-lg font-bold mb-4" style={{ color: "var(--foreground)" }}>Invite New User</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>First Name</label>
                  <input value={inviteFirstName} onChange={e => setInviteFirstName(e.target.value)} className={inputBase} style={inputStyle} placeholder="John" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>Last Name</label>
                  <input value={inviteLastName} onChange={e => setInviteLastName(e.target.value)} className={inputBase} style={inputStyle} placeholder="Doe" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>Email *</label>
                <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} className={inputBase} style={inputStyle} placeholder="user@example.com" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>Role</label>
                <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} className={inputBase} style={inputStyle}>
                  <option value="ADMIN">Admin</option>
                  <option value="EDITOR">Editor</option>
                  <option value="VIEWER">Viewer</option>
                  <option value="API_USER">API User</option>
                </select>
              </div>
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                An invitation email will be sent. The invitee will set their own password.
              </p>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setInviteOpen(false)} className="px-4 py-2 rounded-xl text-sm font-medium border hover:bg-[var(--secondary)] transition-colors" style={{ borderColor: "var(--border)", color: "var(--foreground)" }}>Cancel</button>
              <button onClick={handleInvite} disabled={inviting} className="px-5 py-2 rounded-xl text-sm font-semibold transition-colors hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>
                {inviting ? "Inviting…" : "Send Invite"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Card>
        <CardHeader icon={Users} title="Team Members" action={
          <button onClick={() => setInviteOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>
            <Plus className="w-3.5 h-3.5" /> Invite User
          </button>
        } />
        {isLoading ? (
          <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 rounded-xl animate-pulse" style={{ backgroundColor: "var(--secondary)" }} />
          ))}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["User", "Role", "Last Login", "Logins", "Status", ""].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((user: any) => {
                  const isTargetSuper = user.email === "wedigcreativity@gmail.com";
                  const isSelf = user.id === me?.id;
                  // Admin can't change their own role or other admin roles (only super admin can)
                  // Non-admin users' roles can be changed by any admin
                  const disableRoleChange = isSelf || isTargetSuper || (!isSuperAdmin && user.role === "ADMIN");
                  const disableManage = (!isSuperAdmin && isTargetSuper) || isSelf;

                  return (
                  <tr key={user.id} className="transition-colors hover:bg-[var(--secondary)]/30" style={{ borderBottom: "1px solid var(--border)" }}>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0" style={{ backgroundColor: "rgba(0,1,252,0.1)", color: "var(--primary)" }}>
                          {(user.firstName?.[0] || user.email?.[0] || "U").toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>{user.firstName} {user.lastName}</p>
                          <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <select value={user.role} onChange={e => updateRole.mutate({ id: user.id, role: e.target.value })} disabled={disableRoleChange}
                        className="rounded-lg border px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--primary)] disabled:opacity-50" style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}>
                        {["ADMIN", "EDITOR", "VIEWER", "API_USER"].map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-3 hidden md:table-cell">
                      <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                        {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric" }) : "Never"}
                      </span>
                    </td>
                    <td className="px-3 py-3 hidden lg:table-cell">
                      <span className="text-xs font-medium" style={{ color: "var(--foreground)" }}>{user.loginCount || 0}</span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <button onClick={() => toggleActive.mutate({ id: user.id, isActive: !user.isActive })} disabled={disableManage} className="inline-flex items-center gap-1 text-xs font-medium transition-colors disabled:opacity-50"
                        style={{ color: user.isActive !== false ? "#16a34a" : "#dc2626" }}>
                        {user.isActive !== false ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                      </button>
                    </td>
                    <td className="px-3 py-3 text-right">
                       {isSuperAdmin && user.id !== me?.id && ( // Only super admins can delete users, and not themselves
                         <button onClick={() => handleDelete(user.id)} className="p-1.5 rounded-lg hover:bg-[var(--secondary)] text-[var(--destructive)]">
                           <Trash2 className="w-4 h-4" />
                         </button>
                       )}
                    </td>
                  </tr>
                )}
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Section Renderer ────────────────────────────────────────────────────────

function SectionContent({ section }: { section: SettingsSection }) {
  const map: Record<SettingsSection, React.ReactNode> = {
    profile: <ProfileSection />,
    security: <SecuritySection />,
    notifications: <NotificationsSection />,
    appearance: <AppearanceSection />,
    display: <DisplaySection />,
    email: <EmailSection />,
    backups: <BackupsSection />,
    about: <AboutSection />,
    users: <UsersSection />,
  };
  return <>{map[section]}</>;
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [active, setActive] = useState<SettingsSection>("profile");
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: meData } = useQuery({ queryKey: ["auth-me"], queryFn: async () => (await auth.me()).data.data });
  const { resolvedTheme } = useTheme();

  const activeItem = NAV.find(n => n.key === active)!;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>Account Settings</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>Manage your profile, security, and app preferences</p>
      </div>

      <div className="flex gap-6 items-start">
        {/* ── Desktop Sidebar ── */}
        <nav className="hidden md:flex flex-col w-56 shrink-0 rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
          {NAV.map(item => {
            const Icon = item.icon;
            const isActive = active === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setActive(item.key)}
                className="flex items-center gap-3 px-4 py-3 transition-all text-left relative"
                style={{
                  backgroundColor: isActive ? "rgba(0,1,252,0.06)" : "transparent",
                  color: isActive ? "var(--primary)" : item.danger ? "#dc2626" : "var(--foreground)",
                  borderLeft: isActive ? "2px solid var(--primary)" : "2px solid transparent",
                }}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="text-sm font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* ── Mobile: list → section ── */}
        <div className="flex md:hidden flex-col w-full">
          {!mobileOpen ? (
            <>
              {/* Mobile Profile Header */}
              <div className="rounded-2xl border p-5 mb-4 flex flex-col items-center text-center" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
                {meData?.avatarUrl ? (
                  <img src={meData.avatarUrl} alt="Avatar" className="w-20 h-20 rounded-full object-cover mb-3 border-2" style={{ borderColor: "var(--border)" }} />
                ) : (
                  <div className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold mb-3" style={{ backgroundColor: "rgba(0,1,252,0.1)", color: "var(--primary)" }}>
                    {(meData?.firstName?.[0] || meData?.email?.[0] || "U").toUpperCase()}
                  </div>
                )}
                <p className="text-base font-bold" style={{ color: "var(--foreground)" }}>
                  {meData?.firstName ? `${meData.firstName} ${meData.lastName || ""}`.trim() : meData?.email || "User"}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                  {meData?.role ? meData.role.charAt(0) + meData.role.slice(1).toLowerCase() : "Member"}
                </p>
                <button
                  onClick={() => { setActive("profile"); setMobileOpen(true); }}
                  className="mt-3 px-5 py-2 rounded-xl text-sm font-semibold border transition-colors hover:bg-[var(--secondary)]"
                  style={{ borderColor: "var(--foreground)", color: "var(--foreground)" }}
                >
                  Edit Profile
                </button>
              </div>

            <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
              {NAV.filter(item => item.key !== "profile").map(item => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    onClick={() => { setActive(item.key); setMobileOpen(true); }}
                    className="flex items-center gap-3 w-full px-4 py-3.5 border-b last:border-0 transition-colors hover:bg-[var(--secondary)] text-left"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--secondary)" }}>
                      <Icon className="w-4 h-4" style={{ color: "var(--foreground)" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{item.label}</p>
                      <p className="text-xs truncate" style={{ color: "var(--muted-foreground)" }}>{item.desc}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--muted-foreground)" }} />
                  </button>
                );
              })}
            </div>
            </>
          ) : (
            <div>
              <button onClick={() => setMobileOpen(false)} className="flex items-center gap-2 text-sm font-medium mb-4" style={{ color: "var(--primary)" }}>
                <ChevronLeft className="w-4 h-4" /> Back to Settings
              </button>
              <h2 className="text-lg font-bold mb-4" style={{ color: "var(--foreground)" }}>{activeItem.label}</h2>
              <SectionContent section={active} />
            </div>
          )}
        </div>

        {/* ── Desktop Content ── */}
        <div className="hidden md:block flex-1 min-w-0 pb-[80px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <SectionContent section={active} />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── Right Lanyard ── */}
        <div className="hidden xl:block w-[380px] shrink-0 h-[800px] sticky top-0 overflow-visible z-10 mt-[-100px]">
          <Lanyard
            position={[0, 0, 20]}
            gravity={[0, -40, 0]}
            transparent={true}
            userAvatarUrl={meData?.avatarUrl || undefined}
            logoUrl={resolvedTheme === "dark" ? "/logo-icon-white.png" : "/logo-icon-blue.png"}
          />
        </div>
      </div>
    </div>
  );
}
