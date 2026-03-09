"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useTheme } from "next-themes";

interface ThemeConfig {
  primaryLight: string;
  primaryDark: string;
  fontDisplay: string;
  fontBody: string;
}

interface ThemeConfigContextType extends ThemeConfig {
  setPrimaryLight: (color: string) => void;
  setPrimaryDark: (color: string) => void;
  setFontDisplay: (font: string) => void;
  setFontBody: (font: string) => void;
  resetTheme: () => void;
}

const defaultThemeConfig: ThemeConfig = {
  primaryLight: "#0001fc", // Default original Realtors' Practice blue
  primaryDark: "#4d4eff",  // Default dark mode blue
  fontDisplay: "Space Grotesk",
  fontBody: "Outfit",
};

const ThemeConfigContext = createContext<ThemeConfigContextType | undefined>(undefined);

export function ThemeConfigProvider({ children }: { children: React.ReactNode }) {
  const { theme, systemTheme } = useTheme();
  
  const [config, setConfig] = useState<ThemeConfig>(defaultThemeConfig);
  const [mounted, setMounted] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("realtors-theme-config");
    if (saved) {
      try {
        setConfig(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved theme config", e);
      }
    }
  }, []);

  // Save to localStorage when config changes
  useEffect(() => {
    if (mounted) {
      localStorage.setItem("realtors-theme-config", JSON.stringify(config));
    }
  }, [config, mounted]);

  // Apply CSS Variables + Font Link
  useEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;
    const currentTheme = theme === "system" ? systemTheme : theme;
    const isDark = currentTheme === "dark";

    // Set Colors
    const primaryColor = isDark ? config.primaryDark : config.primaryLight;
    
    // We override both so CSS transition is smooth if user switches theme
    root.style.setProperty("--primary", primaryColor);
    root.style.setProperty("--sidebar-primary", primaryColor);
    root.style.setProperty("--ring", primaryColor);
    root.style.setProperty("--chart-1", primaryColor);

    // Apply Fonts to root
    root.style.setProperty("--font-display", `"${config.fontDisplay}", sans-serif`);
    root.style.setProperty("--font-body", `"${config.fontBody}", sans-serif`);
    
    // Dynamically inject Google Fonts Link if it's not the default
    const buildFontUrl = () => {
      const fonts = new Set([config.fontDisplay, config.fontBody]);
      const families = Array.from(fonts)
        .map(f => `family=${f.replace(/ /g, "+")}:wght@300;400;500;600;700`)
        .join("&");
      return `https://fonts.googleapis.com/css2?${families}&display=swap`;
    };

    let link: HTMLLinkElement | null = document.getElementById("dynamic-theme-fonts") as HTMLLinkElement;
    if (!link) {
      link = document.createElement("link");
      link.id = "dynamic-theme-fonts";
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    link.href = buildFontUrl();

  }, [config, theme, systemTheme, mounted]);

  const setPrimaryLight = (c: string) => setConfig(prev => ({ ...prev, primaryLight: c }));
  const setPrimaryDark = (c: string) => setConfig(prev => ({ ...prev, primaryDark: c }));
  const setFontDisplay = (c: string) => setConfig(prev => ({ ...prev, fontDisplay: c }));
  const setFontBody = (c: string) => setConfig(prev => ({ ...prev, fontBody: c }));
  
  const resetTheme = () => {
    setConfig(defaultThemeConfig);
    document.documentElement.removeAttribute("style");
  };

  return (
    <ThemeConfigContext.Provider value={{ ...config, setPrimaryLight, setPrimaryDark, setFontDisplay, setFontBody, resetTheme }}>
      {children}
    </ThemeConfigContext.Provider>
  );
}

export const useThemeConfig = () => {
  const context = useContext(ThemeConfigContext);
  if (context === undefined) {
    throw new Error("useThemeConfig must be used within a ThemeConfigProvider");
  }
  return context;
};
