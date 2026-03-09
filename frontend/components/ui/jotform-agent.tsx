"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { supabase } from "@/lib/supabase";

declare global {
  interface Window {
    _jfAgentIdentifiedUser?: {
      metadata: Record<string, string>;
      userID: string;
      userHash: string;
    };
    AgentClientSDK?: {
      resetUser: () => void;
    };
    _jfAgentContainerSelector?: string;
  }
}

export function JotformAgent() {
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const agentId = process.env.NEXT_PUBLIC_JOTFORM_AGENT_ID || "019cd1bb37647d8d9261ffea7104c7527f23";

  useEffect(() => {
    let mounted = true;

    async function initAgentUser() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.user) {
          // Unauthenticated user
          if (window.AgentClientSDK?.resetUser) {
             window.AgentClientSDK.resetUser();
          }
          if (mounted) {
             setIsAuthenticated(false);
             setIsReady(true);
          }
          return;
        }

        const user = session.user;
        const metadata = {
          name: `${user.user_metadata?.first_name || ""} ${user.user_metadata?.last_name || ""}`.trim(),
          email: user.email || "",
          role: user.user_metadata?.role || "USER",
        };

        const res = await fetch("/api/jotform-hash", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id }),
        });

        if (!res.ok) throw new Error("Failed to get hash");
        
        const { hash } = await res.json();

        window._jfAgentIdentifiedUser = {
          metadata,
          userID: user.id,
          userHash: hash
        };

        if (mounted) {
            setIsAuthenticated(true);
            setIsReady(true);
        }
      } catch (err) {
        console.error("Failed to init Jotform Agent User", err);
        // Let it load anonymously if auth fetch fails
        if (mounted) {
           setIsAuthenticated(false);
           setIsReady(true);
        }
      }
    }

    initAgentUser();

    // Setup auth listener for login/logout state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        if (window.AgentClientSDK?.resetUser) {
          window.AgentClientSDK.resetUser();
        }
        delete window._jfAgentIdentifiedUser;
        if (mounted) setIsAuthenticated(false);
      } else if (event === 'SIGNED_IN') {
        // Re-init to get the new hash and set auth state
        initAgentUser();
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (!isReady || !isAuthenticated) return null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        /* Force any Jotform injected iframe to respect the padding on mobile */
        @media (max-width: 768px) {
          iframe[src*="agent/embed"], div[id^="Jotform"], div[id^="jotform"], div.ai-agent-chat-avatar-container {
            margin-bottom: 60px !important;
            margin-right: 30px !important;
          }
        }
      `}} />
      <Script 
        src="https://cdn.jotfor.ms/agent/embedjs/019cd1bb37647d8d9261ffea7104c7527f23/embed.js"
        strategy="afterInteractive"
      />
    </>
  );
}
