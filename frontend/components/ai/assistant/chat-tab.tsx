"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Plus,
  Search,
  Mic,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Home,
  BarChart3,
  TrendingUp,
  Settings,
  X,
  MessageSquare,
  Bot,
} from "lucide-react";
import { useAIContext } from "@/contexts/ai-context";
import { usePathname } from "next/navigation";

// ---------- types ----------
interface PropertyMention {
  id: string;
  title: string;
  price?: string;
}

interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
}

// ---------- helpers ----------
function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function generateConversationId() {
  return `conv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// ---------- Typing indicator ----------
function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 mb-4">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
        style={{ background: "linear-gradient(135deg, var(--primary), #3333ff)" }}
      >
        <Bot className="w-3.5 h-3.5 text-white" />
      </div>
      <div
        className="flex items-center gap-1 px-4 py-3 rounded-2xl rounded-bl-sm"
        style={{ backgroundColor: "var(--secondary)" }}
      >
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: "var(--muted-foreground)" }}
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </div>
    </div>
  );
}

// ---------- Reasoning panel ----------
function ReasoningPanel({ content }: { content: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="mt-2 rounded-xl border overflow-hidden"
      style={{ borderColor: "var(--border)" }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium"
        style={{ color: "var(--muted-foreground)", backgroundColor: "var(--secondary)" }}
      >
        <Sparkles className="w-3 h-3" />
        Reasoning
        {open ? <ChevronDown className="w-3 h-3 ml-auto" /> : <ChevronRight className="w-3 h-3 ml-auto" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 py-2 text-xs leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
              {content}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------- Inline property card ----------
function InlinePropertyCard({ prop }: { prop: { title: string; price?: string; area?: string; id?: string } }) {
  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl border mt-2"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: "rgba(0,1,252,0.08)" }}
      >
        <Home className="w-4 h-4" style={{ color: "var(--primary)" }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold truncate" style={{ color: "var(--foreground)" }}>{prop.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {prop.price && (
            <span className="text-[11px] font-bold" style={{ color: "var(--accent)" }}>{prop.price}</span>
          )}
          {prop.area && (
            <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>{prop.area}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Message bubble ----------
function MessageBubble({ message }: { message: { id: string; role: string; content: string; createdAt?: Date; toolInvocations?: any[] } }) {
  const isUser = message.role === "user";

  // Strip <think> blocks for display, extract reasoning
  const thinkMatch = message.content.match(/<think>([\s\S]*?)<\/think>/);
  const reasoning = thinkMatch?.[1]?.trim();
  const displayContent = message.content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

  // Check if tool result contains properties
  const propertyResults: any[] = [];
  if (message.toolInvocations) {
    for (const inv of message.toolInvocations) {
      if (inv.toolName === "search_properties" && inv.result?.properties) {
        propertyResults.push(...inv.result.properties);
      }
    }
  }

  if (isUser) {
    return (
      <div className="flex justify-end mb-4">
        <div
          className="max-w-[75%] px-4 py-3 rounded-2xl rounded-br-sm text-sm leading-relaxed"
          style={{ backgroundColor: "var(--primary)", color: "#fff" }}
        >
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 mb-4">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: "linear-gradient(135deg, var(--primary), #3333ff)" }}
      >
        <Bot className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        {/* AI badge */}
        <div className="flex items-center gap-1.5 mb-1">
          <span
            className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider"
            style={{ backgroundColor: "rgba(0,1,252,0.08)", color: "var(--primary)" }}
          >
            AI
          </span>
          {message.createdAt && (
            <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
              {formatTime(new Date(message.createdAt))}
            </span>
          )}
        </div>

        {/* Message body */}
        <div
          className="max-w-[85%] px-4 py-3 rounded-2xl rounded-tl-sm text-sm leading-relaxed"
          style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)" }}
        >
          <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed whitespace-pre-wrap">
            {displayContent}
          </div>

          {/* Property results */}
          {propertyResults.map((p, i) => (
            <InlinePropertyCard key={i} prop={p} />
          ))}
        </div>

        {/* Reasoning panel */}
        {reasoning && <ReasoningPanel content={reasoning} />}
      </div>
    </div>
  );
}

// ---------- Suggested chips ----------
const BASE_CHIPS = [
  { label: "Find a property", icon: Home },
  { label: "Market report", icon: BarChart3 },
  { label: "Analyze investment", icon: TrendingUp },
  { label: "Check scraper health", icon: Settings },
];

function getContextChips(pathname: string) {
  if (pathname.startsWith("/properties/") && pathname !== "/properties") {
    return [{ label: "Ask about this property", icon: Home }, ...BASE_CHIPS];
  }
  if (pathname.startsWith("/scraper")) {
    return [{ label: "Diagnose last scraper run", icon: Settings }, ...BASE_CHIPS];
  }
  return BASE_CHIPS;
}

function getPageContext(pathname: string): string {
  if (pathname.startsWith("/properties/") && pathname !== "/properties") {
    const id = pathname.split("/properties/")[1]?.split("/")[0];
    return `User is viewing property page${id ? ` (ID: ${id})` : ""}.`;
  }
  if (pathname.startsWith("/scraper")) return "User is on the Scraper page.";
  if (pathname.startsWith("/data-explorer")) return "User is in the Data Explorer.";
  if (pathname.startsWith("/analytics")) return "User is viewing Analytics.";
  if (pathname.startsWith("/market")) return "User is viewing Market Intelligence.";
  return "";
}

// ---------- Context chip ----------
function ContextChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border"
      style={{
        backgroundColor: "rgba(0,1,252,0.06)",
        borderColor: "rgba(0,1,252,0.2)",
        color: "var(--primary)",
      }}
    >
      <Sparkles className="w-3 h-3" />
      {label}
      <button onClick={onRemove} className="ml-0.5 hover:opacity-70">
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

// ---------- Conversation list item ----------
function ConvItem({
  conv,
  active,
  onClick,
}: {
  conv: Conversation;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-2.5 rounded-xl transition-colors text-sm"
      style={{
        backgroundColor: active ? "var(--sidebar-accent)" : undefined,
        color: active ? "var(--sidebar-accent-foreground)" : "var(--foreground)",
      }}
    >
      <p className="font-medium truncate text-xs">{conv.title}</p>
      <div className="flex items-center gap-2 mt-0.5">
        <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
          {new Date(conv.updatedAt).toLocaleDateString()}
        </span>
        <span
          className="px-1.5 py-0.5 rounded text-[9px] font-medium"
          style={{ backgroundColor: "var(--secondary)", color: "var(--muted-foreground)" }}
        >
          {conv.messageCount} msgs
        </span>
      </div>
    </button>
  );
}

// ---------- Main ChatTab ----------
export function ChatTab() {
  const pathname = usePathname() || "";
  const { currentConversationId, setCurrentConversationId, currentContext, setCurrentContext } =
    useAIContext();

  const [localConvId, setLocalConvId] = useState<string>(() => generateConversationId());
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [convSearch, setConvSearch] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [contextChips, setContextChips] = useState<string[]>([]);
  const [mentionDropdownProps, setMentionDropdownProps] = useState<PropertyMention[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const convId = currentConversationId || localConvId;
  const pageCtx = getPageContext(pathname);
  const contextChips_ = getContextChips(pathname);

  // Detect if @ai-sdk/react is available; fall back gracefully
  const [hasAiSdk, setHasAiSdk] = useState(false);

  // Try to import useChat; if unavailable, use fallback
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sdkError, setSdkError] = useState<string | null>(null);

  // We'll use useChat if available, otherwise manual fetch
  let chatHook: any = null;
  try {
    chatHook = useChat({
      api: "/api/ai/chat",
      id: convId,
      body: {
        conversationId: convId,
        context: [pageCtx, ...contextChips].filter(Boolean).join(" "),
      },
    });
  } catch {
    // useChat unavailable (package not installed yet)
  }

  const chatMessages = chatHook?.messages ?? messages;
  const chatInput = chatHook?.input ?? input;
  const chatIsLoading = chatHook?.isLoading ?? isLoading;
  const chatError = chatHook?.error ?? (sdkError ? new Error(sdkError) : null);

  const handleInputChange = chatHook?.handleInputChange ?? ((e: any) => setInputValue(e.target.value));
  const handleSubmit = chatHook?.handleSubmit ?? ((e: any) => {
    e.preventDefault();
    if (!input.trim()) return;
    setMessages((prev) => [...prev, { id: Date.now().toString(), role: "user", content: input, createdAt: new Date() }]);
    setInputValue("");
    setIsLoading(true);
    fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        messages: [...messages, { role: "user", content: input }],
        conversationId: convId,
        context: [pageCtx, ...contextChips].filter(Boolean).join(" "),
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        setMessages((prev) => [
          ...prev,
          { id: Date.now().toString(), role: "assistant", content: data.content || data.message || "Done.", createdAt: new Date() },
        ]);
      })
      .catch((err) => setSdkError(err.message))
      .finally(() => setIsLoading(false));
  });

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatIsLoading]);

  // Auto-resize textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    handleInputChange(e);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";

    // @ mention detection
    const val = ta.value;
    const cursorPos = ta.selectionStart ?? val.length;
    const textBefore = val.slice(0, cursorPos);
    const atMatch = textBefore.match(/@(\w*)$/);
    if (atMatch) {
      setMentionQuery(atMatch[1]);
    } else {
      setMentionQuery(null);
    }
  };

  // New conversation
  const handleNewChat = () => {
    const newId = generateConversationId();
    setLocalConvId(newId);
    setCurrentConversationId(newId);
    setContextChips([]);
  };

  const handleSuggestedChip = (label: string) => {
    if (chatHook?.setInput) {
      chatHook.setInput(label);
    } else {
      setInputValue(label);
    }
    textareaRef.current?.focus();
  };

  const filteredConvs = conversations.filter(
    (c) => !convSearch || c.title.toLowerCase().includes(convSearch.toLowerCase())
  );

  const isEmpty = chatMessages.length === 0;

  return (
    <div className="flex h-full min-h-0">
      {/* Sidebar */}
      <AnimatePresence initial={false}>
        {sidebarOpen && (
          <motion.aside
            key="sidebar"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 220, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="h-full border-r flex flex-col overflow-hidden shrink-0 hidden md:flex"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
          >
            {/* New chat button */}
            <div className="p-3 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
              <button
                onClick={handleNewChat}
                className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm font-medium transition-colors hover:opacity-90"
                style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
              >
                <Plus className="w-4 h-4" />
                New Chat
              </button>
            </div>

            {/* Search */}
            <div className="p-2 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
              <div
                className="flex items-center gap-2 px-2.5 py-2 rounded-lg"
                style={{ backgroundColor: "var(--secondary)" }}
              >
                <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--muted-foreground)" }} />
                <input
                  type="text"
                  placeholder="Search conversations..."
                  value={convSearch}
                  onChange={(e) => setConvSearch(e.target.value)}
                  className="flex-1 text-xs bg-transparent outline-none"
                  style={{ color: "var(--foreground)" }}
                />
              </div>
            </div>

            {/* Conversation list */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredConvs.length === 0 ? (
                <p className="text-center text-[11px] py-6" style={{ color: "var(--muted-foreground)" }}>
                  No conversations yet
                </p>
              ) : (
                filteredConvs.map((c) => (
                  <ConvItem
                    key={c.id}
                    conv={c}
                    active={c.id === convId}
                    onClick={() => setCurrentConversationId(c.id)}
                  />
                ))
              )}

              {/* Current session (if not in list) */}
              <div className="p-1">
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-xl"
                  style={{ backgroundColor: "var(--sidebar-accent)" }}
                >
                  <MessageSquare className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--primary)" }} />
                  <span className="text-xs font-medium truncate" style={{ color: "var(--foreground)" }}>
                    Current session
                  </span>
                </div>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* Message thread */}
        <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0">
          {isEmpty ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center h-full gap-6 text-center px-4">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, var(--primary), #3333ff)" }}
              >
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold font-display mb-1" style={{ color: "var(--foreground)" }}>
                  How can I help you?
                </h2>
                <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                  Ask me about properties, market trends, or investment analysis.
                </p>
              </div>
              {/* Suggested action chips */}
              <div className="flex flex-wrap justify-center gap-2 max-w-md">
                {contextChips_.map(({ label, icon: Icon }) => (
                  <button
                    key={label}
                    onClick={() => handleSuggestedChip(label)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-colors hover:opacity-80"
                    style={{
                      borderColor: "var(--border)",
                      backgroundColor: "var(--secondary)",
                      color: "var(--foreground)",
                    }}
                  >
                    <Icon className="w-3.5 h-3.5" style={{ color: "var(--primary)" }} />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-1">
              {chatMessages.map((msg: any) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              {chatIsLoading && <TypingIndicator />}
              {chatError && (
                <div
                  className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
                  style={{ backgroundColor: "rgba(220,38,38,0.08)", color: "#dc2626" }}
                >
                  <X className="w-4 h-4 shrink-0" />
                  {chatError.message || "Something went wrong. Please try again."}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input bar */}
        <div
          className="shrink-0 border-t px-4 py-3"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}
        >
          <div className="max-w-3xl mx-auto">
            {/* Context chips */}
            {contextChips.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {contextChips.map((chip) => (
                  <ContextChip
                    key={chip}
                    label={chip}
                    onRemove={() => setContextChips((prev) => prev.filter((c) => c !== chip))}
                  />
                ))}
              </div>
            )}

            {/* @ mention dropdown */}
            <AnimatePresence>
              {mentionQuery !== null && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  className="mb-2 rounded-xl border shadow-lg overflow-hidden"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
                >
                  <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
                    Mention a property
                  </div>
                  {mentionDropdownProps.length === 0 ? (
                    <div className="px-3 py-2 text-xs" style={{ color: "var(--muted-foreground)" }}>
                      No properties found. Type to search.
                    </div>
                  ) : (
                    mentionDropdownProps.slice(0, 5).map((p) => (
                      <button
                        key={p.id}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-[var(--secondary)] transition-colors"
                        onClick={() => {
                          setContextChips((prev) => [...prev, `Property: ${p.title}`]);
                          setMentionQuery(null);
                          if (chatHook?.setInput) {
                            chatHook.setInput((v: string) => v.replace(/@\w*$/, ""));
                          } else {
                            setInputValue((v) => v.replace(/@\w*$/, ""));
                          }
                        }}
                      >
                        <Home className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--primary)" }} />
                        <span className="truncate" style={{ color: "var(--foreground)" }}>{p.title}</span>
                        {p.price && (
                          <span className="ml-auto text-[11px] shrink-0" style={{ color: "var(--accent)" }}>{p.price}</span>
                        )}
                      </button>
                    ))
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Textarea + buttons */}
            <form onSubmit={handleSubmit} className="flex items-end gap-2">
              <div
                className="flex-1 flex items-end gap-2 px-3 py-2.5 rounded-2xl border transition-colors"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
              >
                <textarea
                  ref={textareaRef}
                  value={chatInput}
                  onChange={handleTextareaChange}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (!chatIsLoading && chatInput.trim()) {
                        handleSubmit(e as any);
                        if (textareaRef.current) {
                          textareaRef.current.style.height = "auto";
                        }
                      }
                    }
                  }}
                  placeholder="Ask anything... (type @ to mention a property)"
                  rows={1}
                  className="flex-1 resize-none bg-transparent outline-none text-sm leading-relaxed"
                  style={{
                    color: "var(--foreground)",
                    maxHeight: 120,
                    overflowY: "auto",
                  }}
                />
              </div>

              {/* Voice button */}
              <button
                type="button"
                onClick={() => {
                  // Navigate to voice tab
                  document.dispatchEvent(new CustomEvent("ai-switch-tab", { detail: "voice" }));
                }}
                className="flex items-center justify-center w-10 h-10 rounded-xl border transition-colors hover:bg-[var(--secondary)] shrink-0"
                style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
                aria-label="Switch to voice"
              >
                <Mic className="w-4 h-4" />
              </button>

              {/* Send button */}
              <button
                type="submit"
                disabled={!chatInput.trim() || chatIsLoading}
                className="flex items-center justify-center w-10 h-10 rounded-xl transition-all disabled:opacity-40 shrink-0"
                style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
            <p className="text-center text-[10px] mt-1.5" style={{ color: "var(--muted-foreground)" }}>
              Press Enter to send · Shift+Enter for new line
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
