"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Search, ChevronDown, X, Check } from "lucide-react";

// ─── Single-value searchable select ─────────────────────────────────────────

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  className = "",
  style,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!search) return options;
    const q = search.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, search]);

  const selectedLabel = options.find((o) => o.value === value)?.label;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm text-left transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
        style={{
          backgroundColor: "var(--background)",
          borderColor: "var(--border)",
          color: selectedLabel ? "var(--foreground)" : "var(--muted-foreground)",
          ...style,
        }}
      >
        <span className="truncate">{selectedLabel || placeholder}</span>
        <div className="flex items-center gap-1 shrink-0">
          {value && (
            <span
              role="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
                setSearch("");
              }}
              className="p-0.5 rounded hover:bg-[var(--secondary)]"
            >
              <X className="w-3 h-3" style={{ color: "var(--muted-foreground)" }} />
            </span>
          )}
          <ChevronDown className="w-3.5 h-3.5" style={{ color: "var(--muted-foreground)" }} />
        </div>
      </button>

      {open && (
        <div
          className="absolute z-50 mt-1 w-full rounded-lg border shadow-lg overflow-hidden"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          {/* Search input */}
          <div className="p-2 border-b" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-md" style={{ backgroundColor: "var(--secondary)" }}>
              <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--muted-foreground)" }} />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="flex-1 bg-transparent text-xs outline-none"
                style={{ color: "var(--foreground)" }}
              />
            </div>
          </div>

          {/* Options */}
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-xs text-center" style={{ color: "var(--muted-foreground)" }}>
                No results found.
              </div>
            ) : (
              filtered.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                    setSearch("");
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors"
                  style={{
                    backgroundColor: value === opt.value ? "var(--secondary)" : "transparent",
                    color: "var(--foreground)",
                  }}
                  onMouseEnter={(e) => {
                    if (value !== opt.value) e.currentTarget.style.backgroundColor = "var(--secondary)";
                  }}
                  onMouseLeave={(e) => {
                    if (value !== opt.value) e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <Check
                    className="w-3.5 h-3.5 shrink-0"
                    style={{ opacity: value === opt.value ? 1 : 0, color: "var(--primary)" }}
                  />
                  <span className="truncate">{opt.label}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Multi-value searchable select (checkbox list with search) ──────────────

interface SearchableMultiSelectProps {
  values: string[];
  onChange: (values: string[]) => void;
  options: { value: string; label: string; sublabel?: string }[];
  placeholder?: string;
  searchPlaceholder?: string;
  maxHeight?: number;
  className?: string;
}

export function SearchableMultiSelect({
  values,
  onChange,
  options,
  placeholder = "Select...",
  searchPlaceholder = "Filter...",
  maxHeight = 192,
  className = "",
}: SearchableMultiSelectProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return options;
    const q = search.toLowerCase();
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || (o.sublabel && o.sublabel.toLowerCase().includes(q))
    );
  }, [options, search]);

  const toggle = (val: string) => {
    onChange(values.includes(val) ? values.filter((v) => v !== val) : [...values, val]);
  };

  return (
    <div className={className}>
      {/* Search input */}
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-t-lg border"
        style={{ backgroundColor: "var(--secondary)", borderColor: "var(--border)" }}
      >
        <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--muted-foreground)" }} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={searchPlaceholder}
          className="flex-1 bg-transparent text-xs outline-none"
          style={{ color: "var(--foreground)" }}
        />
        {search && (
          <button type="button" onClick={() => setSearch("")} className="p-0.5">
            <X className="w-3 h-3" style={{ color: "var(--muted-foreground)" }} />
          </button>
        )}
      </div>

      {/* Options list */}
      <div
        className="rounded-b-lg border border-t-0 overflow-y-auto"
        style={{ borderColor: "var(--border)", maxHeight }}
      >
        {filtered.length === 0 ? (
          <div className="px-3 py-4 text-xs text-center" style={{ color: "var(--muted-foreground)" }}>
            No matches found.
          </div>
        ) : (
          filtered.map((opt) => {
            const checked = values.includes(opt.value);
            return (
              <label
                key={opt.value}
                className="flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors text-sm"
                style={{ color: "var(--foreground)" }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--secondary)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(opt.value)}
                  className="rounded accent-[var(--primary)]"
                />
                <div className="min-w-0 flex-1">
                  <span className="block truncate">{opt.label}</span>
                  {opt.sublabel && (
                    <span className="block text-[10px] truncate" style={{ color: "var(--muted-foreground)" }}>
                      {opt.sublabel}
                    </span>
                  )}
                </div>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}
