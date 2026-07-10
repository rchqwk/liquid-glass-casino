"use client";

import { useEffect } from "react";

export default function DiscordV2Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Discord V2 Error]", error);
  }, [error]);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#050508",
        padding: "20px",
      }}
    >
      <div
        style={{
          backgroundColor: "#101018",
          borderRadius: "16px",
          padding: "32px",
          maxWidth: "400px",
          border: "1px solid rgba(255,51,102,0.3)",
          textAlign: "center",
        }}
      >
        <h1
          style={{
            margin: 0,
            marginBottom: "12px",
            fontSize: "20px",
            fontWeight: 700,
            color: "#ff6688",
          }}
        >
          Something went wrong
        </h1>
        <p
          style={{
            margin: 0,
            marginBottom: "20px",
            color: "#aaa",
            fontSize: "14px",
          }}
        >
          {error.message || "An unexpected error occurred"}
        </p>
        <button
          onClick={reset}
          style={{
            backgroundColor: "#00f5ff",
            color: "#050508",
            border: "none",
            borderRadius: "10px",
            padding: "12px 24px",
            fontSize: "14px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
