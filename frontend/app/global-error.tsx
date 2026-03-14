"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Global Error Boundary]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            "'Outfit', 'Space Grotesk', system-ui, -apple-system, sans-serif",
          backgroundColor: "#F7F7F7",
          color: "#1A1A1A",
          padding: "24px",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "420px",
            backgroundColor: "#FFFFFF",
            border: "1px solid #E5E5E5",
            borderRadius: "12px",
            padding: "32px",
            textAlign: "center",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          }}
        >
          {/* Icon */}
          <div
            style={{
              width: "56px",
              height: "56px",
              margin: "0 auto 16px",
              borderRadius: "50%",
              backgroundColor: "rgba(220, 38, 38, 0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#DC2626"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" x2="12" y1="8" y2="12" />
              <line x1="12" x2="12.01" y1="16" y2="16" />
            </svg>
          </div>

          <h2
            style={{
              fontSize: "20px",
              fontWeight: 600,
              margin: "0 0 8px",
              fontFamily: "'Space Grotesk', system-ui, sans-serif",
            }}
          >
            Something went wrong
          </h2>
          <p
            style={{
              fontSize: "14px",
              color: "#6B7280",
              margin: "0 0 24px",
              lineHeight: 1.5,
            }}
          >
            A critical error occurred. Please try again or refresh the page.
          </p>

          {/* Try Again button */}
          <button
            onClick={reset}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#0001FC",
              color: "#FFFFFF",
              border: "none",
              borderRadius: "8px",
              padding: "10px 20px",
              fontSize: "14px",
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Try Again
          </button>

          {/* Error details */}
          <details
            style={{
              marginTop: "24px",
              textAlign: "left",
              border: "1px solid #E5E5E5",
              borderRadius: "8px",
            }}
          >
            <summary
              style={{
                cursor: "pointer",
                padding: "10px 16px",
                fontSize: "12px",
                fontWeight: 500,
                color: "#6B7280",
                userSelect: "none",
              }}
            >
              Error details
            </summary>
            <pre
              style={{
                margin: 0,
                padding: "12px 16px",
                fontSize: "12px",
                lineHeight: 1.5,
                color: "#6B7280",
                backgroundColor: "#F7F7F7",
                borderTop: "1px solid #E5E5E5",
                overflow: "auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {error.message || "Unknown error"}
              {error.digest && `\n\nDigest: ${error.digest}`}
            </pre>
          </details>
        </div>
      </body>
    </html>
  );
}
