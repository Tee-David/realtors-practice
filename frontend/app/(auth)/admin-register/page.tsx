"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { auth } from "@/lib/api";
import Image from "next/image";
import Link from "next/link";
import { Eye, EyeOff, ArrowRight, Loader2, CheckCircle2, ShieldCheck, CheckCircle, KeyRound } from "lucide-react";
import { ThemeSwitch } from "@/components/ui/theme-switch";

type Step = "code" | "register" | "success";

interface InviteData {
  email: string;
  role: string;
  firstName?: string;
  lastName?: string;
}

export default function AdminRegisterPage() {
  const searchParams = useSearchParams();

  const [step, setStep] = useState<Step>("code");
  const [inviteCode, setInviteCode] = useState("");
  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [validating, setValidating] = useState(false);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Pre-fill code and email from URL params (from invite email link)
  useEffect(() => {
    const codeParam = searchParams.get("code");
    const emailParam = searchParams.get("email");
    if (codeParam) {
      setInviteCode(codeParam);
      // Auto-validate if code is in URL
      validateCode(codeParam);
    }
    if (emailParam) {
      setFormData(prev => ({ ...prev, email: emailParam }));
    }
  }, [searchParams]);

  async function validateCode(code?: string) {
    const codeToValidate = code || inviteCode;
    if (!codeToValidate.trim()) {
      setError("Please enter your invitation code");
      return;
    }

    setError("");
    setValidating(true);

    try {
      const { data: res } = await auth.validateInvite(codeToValidate.trim().toUpperCase());
      const invite = res.data as InviteData;
      setInviteData(invite);
      setFormData(prev => ({
        ...prev,
        email: invite.email,
        firstName: invite.firstName || prev.firstName,
        lastName: invite.lastName || prev.lastName,
      }));
      setInviteCode(codeToValidate.trim().toUpperCase());
      setStep("register");
    } catch (err: any) {
      setError(err?.response?.data?.message || "Invalid or expired invitation code");
    } finally {
      setValidating(false);
    }
  }

  function updateField(key: string, value: string) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (!/[a-z]/.test(formData.password)) { setError("Password must have at least one lowercase character"); return; }
    if (!/[A-Z]/.test(formData.password)) { setError("Password must have at least one uppercase character"); return; }
    if (!/[0-9]/.test(formData.password)) { setError("Password must have at least one number"); return; }
    if (!/[^a-zA-Z0-9]/.test(formData.password)) { setError("Password must have at least one special character"); return; }
    if (formData.password.length < 8) { setError("Password must be at least 8 characters"); return; }

    setLoading(true);

    try {
      await auth.registerWithCode({
        code: inviteCode,
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName || undefined,
        lastName: formData.lastName || undefined,
      });
      setStep("success");
    } catch (err: any) {
      setError(err?.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  // ── Success Screen ──
  if (step === "success") {
    return (
      <div className="w-full max-w-[400px]">
        <div className="flex items-center gap-3 mb-10 lg:hidden">
          <Image src="/logo-icon-blue.png" alt="RP" width={36} height={36} />
          <span className="font-display font-bold text-lg" style={{ color: "var(--foreground)" }}>
            Realtors&apos; Practice
          </span>
        </div>

        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6"
          style={{ backgroundColor: "#f0fdf4" }}
        >
          <CheckCircle2 size={28} style={{ color: "var(--success)" }} />
        </div>
        <h1
          className="font-display text-2xl font-bold tracking-tight"
          style={{ color: "var(--foreground)" }}
        >
          Account created!
        </h1>
        <p className="text-sm mt-2 leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
          Your account has been set up as <strong>{inviteData?.role?.toLowerCase().replace("_", " ")}</strong>. You can now sign in with your credentials.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 mt-6 py-3 px-6 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
          style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          Go to login
          <ArrowRight size={16} />
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[400px]">
      {/* Mobile logo & Theme switch */}
      <div className="flex items-center justify-between mb-10 lg:hidden w-full -ml-4">
        <div className="relative">
          <Image src="/hlogo-blue.png" alt="Realtors' Practice" width={180} height={45} style={{ objectFit: "contain" }} className="dark:hidden" />
          <Image src="/hlogo-white.png" alt="Realtors' Practice" width={180} height={45} style={{ objectFit: "contain" }} className="hidden dark:block" />
        </div>
        <div className="scale-90 origin-right translate-x-2">
          <ThemeSwitch />
        </div>
      </div>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(0, 1, 252, 0.08)" }}>
            {step === "code" ? <KeyRound size={20} style={{ color: "var(--primary)" }} /> : <ShieldCheck size={20} style={{ color: "var(--primary)" }} />}
          </div>
        </div>
        <h1 className="font-display text-2xl font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
          {step === "code" ? "Enter invitation code" : "Create your account"}
        </h1>
        <p className="text-sm mt-1.5" style={{ color: "var(--muted-foreground)" }}>
          {step === "code"
            ? "You need an invitation code from an admin to register"
            : `Setting up account as ${inviteData?.role?.toLowerCase().replace("_", " ")}`}
        </p>
      </div>

      {/* Error */}
      {error && (
        <div
          className="flex items-center gap-2 p-3 rounded-xl text-sm mb-4"
          style={{ backgroundColor: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}
        >
          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: "#dc2626" }} />
          {error}
        </div>
      )}

      {/* Step 1: Invite Code */}
      {step === "code" && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
              Invitation Code
            </label>
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              maxLength={6}
              className="w-full px-4 py-3 rounded-xl text-center text-2xl font-bold tracking-[0.3em] outline-none transition-all focus:ring-2"
              style={{
                border: "1px solid var(--border)",
                backgroundColor: "var(--background)",
                color: "var(--foreground)",
                fontFamily: "'Space Grotesk', monospace",
              }}
              placeholder="A3F1B2"
              autoFocus
            />
          </div>

          <button
            onClick={() => validateCode()}
            disabled={validating || inviteCode.length < 6}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 hover:opacity-90"
            style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
          >
            {validating ? (
              <><Loader2 size={16} className="animate-spin" /> Validating...</>
            ) : (
              <><ArrowRight size={16} /> Continue</>
            )}
          </button>

          <p className="text-center text-xs" style={{ color: "var(--muted-foreground)" }}>
            Don&apos;t have an invitation code? Ask an admin to invite you.
          </p>
        </div>
      )}

      {/* Step 2: Registration Form */}
      {step === "register" && (
        <form onSubmit={handleRegister} className="space-y-4">
          {/* Role badge */}
          <div className="flex items-center gap-2 p-3 rounded-xl" style={{ backgroundColor: "rgba(0,1,252,0.05)", border: "1px solid rgba(0,1,252,0.15)" }}>
            <ShieldCheck size={16} style={{ color: "var(--primary)" }} />
            <span className="text-xs font-medium" style={{ color: "var(--primary)" }}>
              Registering as {inviteData?.role?.toLowerCase().replace("_", " ")} for {inviteData?.email}
            </span>
          </div>

          {/* Name row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>First name</label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => updateField("firstName", e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all focus:ring-2"
                style={{ border: "1px solid var(--border)", backgroundColor: "var(--background)", color: "var(--foreground)" }}
                placeholder="John"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>Last name</label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => updateField("lastName", e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all focus:ring-2"
                style={{ border: "1px solid var(--border)", backgroundColor: "var(--background)", color: "var(--foreground)" }}
                placeholder="Doe"
              />
            </div>
          </div>

          {/* Email (read-only, from invitation) */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>Email address</label>
            <input
              type="email"
              value={formData.email}
              readOnly
              className="w-full px-4 py-3 rounded-xl text-sm outline-none cursor-not-allowed opacity-70"
              style={{ border: "1px solid var(--border)", backgroundColor: "var(--secondary)", color: "var(--foreground)" }}
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) => updateField("password", e.target.value)}
                required
                autoComplete="new-password"
                className="w-full px-4 py-3 pr-11 rounded-xl text-sm outline-none transition-all focus:ring-2"
                style={{ border: "1px solid var(--border)", backgroundColor: "var(--background)", color: "var(--foreground)" }}
                placeholder="Enter a secure password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md"
                style={{ color: "var(--muted-foreground)" }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Password checklist */}
            {formData.password && (
              <div className="p-4 rounded-xl mt-3" style={{ backgroundColor: "var(--secondary)" }}>
                <p className="text-xs font-semibold mb-3" style={{ color: "var(--foreground)" }}>Your Password must include</p>
                <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                  {[
                    { test: /[a-z]/, label: "one lowercase character" },
                    { test: /[A-Z]/, label: "one uppercase character" },
                    { test: /[0-9]/, label: "one number" },
                    { test: /[^a-zA-Z0-9]/, label: "one special character" },
                    { test: { test: () => formData.password.length >= 8 }, label: "8 character minimum" },
                  ].map(({ test, label }) => {
                    const passed = "test" in test ? (test as RegExp).test(formData.password) : (test as any).test();
                    return (
                      <div key={label} className="flex items-center text-xs">
                        <span className={`mr-2 rounded-full w-4 h-4 flex items-center justify-center ${passed ? "bg-green-600" : "bg-transparent border border-muted-foreground/30"}`}>
                          {passed && <CheckCircle size={10} className="text-white" />}
                        </span>
                        <span style={{ color: passed ? "var(--foreground)" : "var(--muted-foreground)" }}>{label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Confirm password */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>Confirm password</label>
            <input
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => updateField("confirmPassword", e.target.value)}
              required
              autoComplete="new-password"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all focus:ring-2"
              style={{ border: "1px solid var(--border)", backgroundColor: "var(--background)", color: "var(--foreground)" }}
              placeholder="Re-enter your password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 hover:opacity-90 mt-2"
            style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
          >
            {loading ? (
              <><Loader2 size={16} className="animate-spin" /> Creating account...</>
            ) : (
              <><>Create account</> <ArrowRight size={16} /></>
            )}
          </button>
        </form>
      )}

      {/* Footer */}
      <p className="text-center text-sm mt-6" style={{ color: "var(--muted-foreground)" }}>
        Already have an account?{" "}
        <Link href="/login" className="font-medium hover:underline" style={{ color: "var(--primary)" }}>
          Sign in
        </Link>
      </p>
    </div>
  );
}
