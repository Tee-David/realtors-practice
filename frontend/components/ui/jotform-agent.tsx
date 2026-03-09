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
  }
}

export function JotformAgent() {
  const [isReady, setIsReady] = useState(false);
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
          if (mounted) setIsReady(true);
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

        if (mounted) setIsReady(true);
      } catch (err) {
        console.error("Failed to init Jotform Agent User", err);
        // Let it load anonymously if auth fetch fails
        if (mounted) setIsReady(true);
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
      } else if (event === 'SIGNED_IN') {
        // Re-init to get the new hash
        initAgentUser();
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (!isReady) return null;

  return (
    <Script 
      src={`https://cdn.jotfor.ms/agent/embedjs/${agentId}/embed.js`}
      strategy="afterInteractive"
    />
  );
}
