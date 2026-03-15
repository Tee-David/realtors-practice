"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Search, X, Loader2, Mic, MicOff, ChevronDown, Clock, Trash2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { useSearchSuggestions } from "@/hooks/use-search";
import { useGeocode } from "@/hooks/use-geocode";
import { formatPrice } from "@/lib/utils";
import TextType from "@/components/ui/TextType";
import type { PropertyCategory } from "@/types/property";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const SEARCH_EXAMPLES = [
  "3 bedroom flat in Lekki under 30M",
  "Detached duplex in Ikoyi with pool",
  "2 bed apartment in Abuja under 3M",
  "Land for sale in Ajah below 20M",
  "Furnished studio in Victoria Island",
];

const CATEGORIES: { value: PropertyCategory | "ALL"; label: string }[] = [
  { value: "ALL", label: "All Categories" },
  { value: "RESIDENTIAL", label: "Residential" },
  { value: "COMMERCIAL", label: "Commercial" },
  { value: "LAND", label: "Land" },
  { value: "SHORTLET", label: "Shortlet" },
  { value: "INDUSTRIAL", label: "Industrial" },
];

const RECENT_SEARCHES_KEY = "rp-recent-searches";
const MAX_RECENT = 6;

/* ------------------------------------------------------------------ */
/*  Speech-to-text hook                                                */
/* ------------------------------------------------------------------ */

function useSpeechRecognition(onResult: (text: string, isFinal: boolean) => void) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setIsSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-NG";
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: any) => {
        let transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join("");

        // Phonetic fix for common Nigerian terms that Google Speech might botch
        const NIGERIAN_DICT: Record<string, string> = {
          "leki": "Lekki",
          "ikoy": "Ikoyi",
          "ikeya": "Ikeja",
          "shurulere": "Surulere",
          "yava": "Yaba",
          "aja": "Ajah",
          "gbaganda": "Gbagada",
          "ojudu": "Ojodu",
          "viktor": "Victoria",
          "makoko": "Makoko",
          "banana": "Banana",
          "ilopeju": "Ilupeju",
          "magodo": "Magodo"
        };

        // Simple word boundary replacement
        Object.entries(NIGERIAN_DICT).forEach(([wrong, right]) => {
          const regex = new RegExp(`\\b${wrong}\\b`, 'gi');
          transcript = transcript.replace(regex, right);
        });

        const isFinal = event.results[event.results.length - 1].isFinal;
        onResult(transcript, isFinal);
      };

      recognition.onend = () => setIsListening(false);
      recognition.onerror = (event: any) => {
        if (event.error === "not-allowed") {
          setIsListening(false);
          toast.error("Microphone access denied. Please allow microphone permissions in your browser.");
        } else if (event.error === "network") {
          // Many browsers throw a network error for SpeechRecognition when offline or disconnected.
          // In some cases Chrome throws this randomly while transcribing. We'll simply ignore the toast
          // but we have to set listening to false because the API stops recording on network error.
          setIsListening(false);
          console.warn("Speech recognition network error gracefully ignored.");
        } else if (event.error === "no-speech") {
          setIsListening(false);
          // just gracefully ignore the timeout
        } else if (event.error === "aborted") {
          setIsListening(false);
          // user stopped the recognition, safely ignore
        } else {
          setIsListening(false);
          toast.error(`Voice search error: ${event.error}`);
        }
      };

      recognitionRef.current = recognition;
    }
  }, [onResult]);

  const toggle = useCallback(() => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  }, [isListening]);

  return { isListening, isSupported, toggle };
}

/* ------------------------------------------------------------------ */
/*  Recent searches helpers                                            */
/* ------------------------------------------------------------------ */

function getRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveRecentSearch(query: string) {
  const recent = getRecentSearches().filter((q) => q !== query);
  recent.unshift(query);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

function clearRecentSearches() {
  localStorage.removeItem(RECENT_SEARCHES_KEY);
}

/* ------------------------------------------------------------------ */
/*  SearchBar Component                                                */
/* ------------------------------------------------------------------ */

interface SearchBarProps {
  onSearch: (query: string, category?: PropertyCategory | "ALL") => void;
  initialQuery?: string;
  initialCategory?: PropertyCategory | "ALL";
}

export function SearchBar({
  onSearch,
  initialQuery = "",
  initialCategory = "ALL",
}: SearchBarProps) {
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState<PropertyCategory | "ALL">(initialCategory);
  const [focused, setFocused] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const categoryRef = useRef<HTMLDivElement>(null);

  const [debouncedGeoQuery, setDebouncedGeoQuery] = useState("");
  const { data: suggestions, isLoading: suggestionsLoading } = useSearchSuggestions(query);
  const { data: geoSuggestions } = useGeocode(debouncedGeoQuery);

  // Debounce geocoding requests
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedGeoQuery(query), 400);
    return () => clearTimeout(timer);
  }, [query]);

  const handleVoiceResult = useCallback((text: string, isFinal: boolean) => {
    setQuery(text);
    if (isFinal && text.trim().length > 0) {
      setShowDropdown(false);
      saveRecentSearch(text.trim());
      setRecentSearches(getRecentSearches());
      onSearch(text.trim(), category);
    } else {
      setShowDropdown(true);
    }
  }, [category, onSearch]);

  const { isListening, isSupported, toggle: toggleMic } = useSpeechRecognition(handleVoiceResult);

  // Load preferences
  useEffect(() => {
    setRecentSearches(getRecentSearches());
  }, []);

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
      if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) {
        setShowCategoryMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      saveRecentSearch(query.trim());
      setRecentSearches(getRecentSearches());
      setShowDropdown(false);
      onSearch(query.trim(), category);
    }
  }

  function handleSuggestionClick(title: string) {
    setQuery(title);
    saveRecentSearch(title);
    setRecentSearches(getRecentSearches());
    setShowDropdown(false);
    onSearch(title, category);
  }

  function handleClearRecent() {
    clearRecentSearches();
    setRecentSearches([]);
  }

  const selectedCategoryLabel = CATEGORIES.find((c) => c.value === category)?.label || "All";
  const hasQuery = query.length >= 2;
  const showSuggestions = showDropdown && hasQuery;
  const showRecent = showDropdown && !hasQuery && recentSearches.length > 0;

  return (
    <div ref={containerRef} className="relative w-full" data-tour="search-bar">
      <form onSubmit={handleSubmit}>
        <div
          className="flex items-center rounded-2xl transition-shadow"
          style={{
            backgroundColor: "var(--card)",
            border: "1.5px solid var(--border)",
            boxShadow: focused ? "0 0 0 3px rgba(0,1,252,0.08)" : "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          {/* Category dropdown */}
          <div ref={categoryRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setShowCategoryMenu(!showCategoryMenu)}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium transition-colors h-full"
              style={{
                color: "var(--foreground)",
                borderRight: "1px solid var(--border)",
              }}
            >
              <span className="hidden sm:inline">{selectedCategoryLabel}</span>
              <span className="sm:hidden">
                {category === "ALL" ? "All" : selectedCategoryLabel.slice(0, 5)}
              </span>
              <ChevronDown
                size={13}
                style={{ color: "var(--muted-foreground)" }}
                className={`transition-transform ${showCategoryMenu ? "rotate-180" : ""}`}
              />
            </button>

            {/* Category dropdown menu */}
            {showCategoryMenu && (
              <div
                className="absolute top-full left-0 mt-2 w-48 rounded-xl shadow-lg overflow-hidden z-50"
                style={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                }}
              >
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => {
                      setCategory(cat.value);
                      setShowCategoryMenu(false);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm font-medium transition-colors hover:bg-[var(--secondary)]"
                    style={{
                      color: category === cat.value ? "var(--primary)" : "var(--foreground)",
                      backgroundColor:
                        category === cat.value ? "rgba(0,1,252,0.04)" : "transparent",
                    }}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Search icon */}
          <div className="pl-3">
            <Search size={16} className="shrink-0" style={{ color: "var(--muted-foreground)" }} />
          </div>

          {/* Input with animated placeholder */}
          <div className="relative flex-1 min-w-0 px-2">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => {
                setFocused(true);
                setShowDropdown(true);
              }}
              onBlur={() => setFocused(false)}
              className="bg-transparent text-xs sm:text-sm w-full outline-none py-3 relative z-10"
              style={{ color: "var(--foreground)" }}
              autoComplete="off"
            />
            {!query && !focused && (
              <div className="absolute inset-0 flex items-center pointer-events-none overflow-hidden px-0">
                <TextType
                  text={SEARCH_EXAMPLES}
                  typingSpeed={45}
                  deletingSpeed={30}
                  pauseDuration={5000}
                  showCursor={false}
                  loop={true}
                  className="text-xs sm:text-sm truncate"
                  style={{ color: "var(--muted-foreground)" }}
                />
              </div>
            )}
          </div>

          {/* Clear button */}
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="p-1.5 mr-1 rounded-full hover:bg-[var(--secondary)] transition-colors"
            >
              <X size={14} style={{ color: "var(--muted-foreground)" }} />
            </button>
          )}

          {/* Mic button */}
          {isSupported && (
            <button
              data-tour="voice-btn"
              type="button"
              onClick={toggleMic}
              className="p-2 mr-1 rounded-full transition-all relative"
              style={{
                backgroundColor: isListening ? "var(--destructive)" : "transparent",
                color: isListening ? "#fff" : "var(--muted-foreground)",
              }}
              title={isListening ? "Stop listening" : "Voice search"}
            >
              {isListening ? <MicOff size={16} /> : <Mic size={16} />}
              {isListening && (
                <span
                  className="absolute inset-0 rounded-full animate-ping"
                  style={{ backgroundColor: "var(--destructive)", opacity: 0.3 }}
                />
              )}
            </button>
          )}

          {/* Submit button */}
          <button
            type="submit"
            className="px-4 sm:px-5 py-3 text-xs sm:text-sm font-semibold text-white transition-opacity hover:opacity-90 h-full rounded-r-2xl"
            style={{ backgroundColor: "var(--primary)" }}
          >
            Search
          </button>
        </div>
      </form>

      {/* Listening indicator */}
      {isListening && (
        <div
          className="flex items-center gap-2 mt-2 px-4 py-2 rounded-xl text-sm"
          style={{
            backgroundColor: "rgba(239,68,68,0.06)",
            color: "var(--destructive)",
          }}
        >
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="w-1.5 h-3 rounded-full bg-red-400 animate-pulse" style={{ animationDelay: "150ms" }} />
            <span className="w-1.5 h-2 rounded-full bg-red-500 animate-pulse" style={{ animationDelay: "300ms" }} />
          </div>
          <span className="font-medium text-xs">Listening… Speak now</span>
        </div>
      )}

      {/* Dropdown: Recent Searches */}
      {showRecent && (
        <div
          className="absolute top-full left-0 right-0 mt-2 rounded-xl shadow-lg overflow-hidden z-50"
          style={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
          }}
        >
          <div className="flex items-center justify-between px-4 py-2.5">
            <span
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: "var(--muted-foreground)" }}
            >
              Recent Searches
            </span>
            <button
              type="button"
              onClick={handleClearRecent}
              className="flex items-center gap-1 text-[11px] font-medium hover:underline"
              style={{ color: "var(--muted-foreground)" }}
            >
              <Trash2 size={11} />
              Clear
            </button>
          </div>
          <ul>
            {recentSearches.map((item, idx) => (
              <li key={idx}>
                <button
                  type="button"
                  onClick={() => handleSuggestionClick(item)}
                  className="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-[var(--secondary)] transition-colors"
                >
                  <Clock size={14} style={{ color: "var(--muted-foreground)" }} className="shrink-0" />
                  <span className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>
                    {item}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Dropdown: Suggestions + Location Autocomplete */}
      {showSuggestions && (
        <div
          className="absolute top-full left-0 right-0 mt-2 rounded-xl shadow-lg overflow-hidden z-50 max-h-[60vh] overflow-y-auto"
          style={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
          }}
        >
          {suggestionsLoading ? (
            <div className="flex items-center justify-center py-6 gap-2">
              <Loader2
                size={16}
                className="animate-spin"
                style={{ color: "var(--muted-foreground)" }}
              />
              <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                Searching...
              </span>
            </div>
          ) : (
            <>
              {/* Property suggestions */}
              {suggestions && suggestions.length > 0 && (
                <>
                  <div className="px-4 py-2 border-b" style={{ borderColor: "var(--border)" }}>
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
                      Properties
                    </span>
                  </div>
                  <ul>
                    {suggestions.map((item: any, idx: number) => (
                      <li key={idx}>
                        <button
                          type="button"
                          onClick={() => handleSuggestionClick(item.title)}
                          className="w-full text-left px-4 py-2.5 flex items-center justify-between hover:bg-[var(--secondary)] transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Search size={13} style={{ color: "var(--muted-foreground)" }} className="shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>
                                {item.title}
                              </p>
                              {item.location && (
                                <p className="text-xs truncate" style={{ color: "var(--muted-foreground)" }}>
                                  {item.location}
                                </p>
                              )}
                            </div>
                          </div>
                          {item.price && (
                            <span
                              className="text-xs font-semibold shrink-0 ml-3"
                              style={{ color: "var(--accent)" }}
                            >
                              {formatPrice(item.price)}
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {/* Location autocomplete from Nominatim */}
              {geoSuggestions && geoSuggestions.length > 0 && (
                <>
                  <div className="px-4 py-2 border-b border-t" style={{ borderColor: "var(--border)" }}>
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
                      Locations
                    </span>
                  </div>
                  <ul>
                    {geoSuggestions.map((place, idx) => {
                      const parts = place.display_name.split(",");
                      const primary = parts.slice(0, 2).join(",").trim();
                      const secondary = parts.slice(2, 4).join(",").trim();
                      return (
                        <li key={idx}>
                          <button
                            type="button"
                            onClick={() => handleSuggestionClick(primary)}
                            className="w-full text-left px-4 py-2.5 flex items-center gap-2.5 hover:bg-[var(--secondary)] transition-colors"
                          >
                            <MapPin size={13} style={{ color: "var(--primary)" }} className="shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>
                                {primary}
                              </p>
                              {secondary && (
                                <p className="text-xs truncate" style={{ color: "var(--muted-foreground)" }}>
                                  {secondary}
                                </p>
                              )}
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}

              {/* No results at all */}
              {(!suggestions || suggestions.length === 0) && (!geoSuggestions || geoSuggestions.length === 0) && (
                <div className="py-5 text-center">
                  <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                    No suggestions found
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
