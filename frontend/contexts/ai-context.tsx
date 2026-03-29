"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

interface AIContextValue {
  currentConversationId: string | null;
  setCurrentConversationId: (id: string | null) => void;
  currentContext: string;
  setCurrentContext: (ctx: string) => void;
  activeTab: "chat" | "voice" | "history";
  setActiveTab: (tab: "chat" | "voice" | "history") => void;
}

const AIContext = createContext<AIContextValue | null>(null);

export function AIProvider({ children }: { children: React.ReactNode }) {
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [currentContext, setCurrentContext] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"chat" | "voice" | "history">("chat");

  return (
    <AIContext.Provider
      value={{
        currentConversationId,
        setCurrentConversationId,
        currentContext,
        setCurrentContext,
        activeTab,
        setActiveTab,
      }}
    >
      {children}
    </AIContext.Provider>
  );
}

export function useAIContext() {
  const ctx = useContext(AIContext);
  if (!ctx) throw new Error("useAIContext must be used within AIProvider");
  return ctx;
}
