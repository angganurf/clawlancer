"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";

// ── Phase machine ─────────────────────────────────────────────────────────────
type Phase =
  | "prompt"      // Initial screen asking to connect Gmail
  | "loading"     // Fetching metadata + Claude analysis
  | "insights"    // Animated insight reveal (8 items)
  | "summary"     // Summary cards screen
  | "error";      // Something went wrong

// ── Bubble colors ─────────────────────────────────────────────────────────────
const BUBBLE_COLORS = [
  "radial-gradient(circle at 35% 30%, rgba(34,197,94,0.7), rgba(34,197,94,0.35) 50%, rgba(22,163,74,0.7) 100%)",
  "radial-gradient(circle at 35% 30%, rgba(147,51,234,0.7), rgba(147,51,234,0.35) 50%, rgba(126,34,206,0.7) 100%)",
  "radial-gradient(circle at 35% 30%, rgba(59,130,246,0.7), rgba(59,130,246,0.35) 50%, rgba(37,99,235,0.7) 100%)",
  "radial-gradient(circle at 35% 30%, rgba(6,182,212,0.7), rgba(6,182,212,0.35) 50%, rgba(8,145,178,0.7) 100%)",
];

const BUBBLE_SHADOWS = [
  "rgba(34,197,94,0.35) 0px 4px 12px 0px",
  "rgba(147,51,234,0.35) 0px 4px 12px 0px",
  "rgba(59,130,246,0.35) 0px 4px 12px 0px",
  "rgba(6,182,212,0.35) 0px 4px 12px 0px",
];

// Cookie name for CSRF state (must match callback route)
const GMAIL_STATE_COOKIE = "ic_gmail_state";

// ── Google OAuth ──────────────────────────────────────────────────────────────
function buildGmailOAuthUrl() {
  // Generate and store CSRF state in a cookie before redirecting
  const state = crypto.randomUUID();
  document.cookie = `${GMAIL_STATE_COOKIE}=${state}; path=/; max-age=600; SameSite=Lax`;

  const params = new URLSearchParams({
    client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
    redirect_uri: `${window.location.origin}/api/auth/gmail/callback`,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/gmail.readonly",
    access_type: "online",
    include_granted_scopes: "true",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export default function GmailConnectPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("prompt");
  const [insights, setInsights] = useState<string[]>([]);
  const [summary, setSummary] = useState("");
  const [cards, setCards] = useState<{ title: string; description: string }[]>([]);
  const [currentInsight, setCurrentInsight] = useState(0);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);

  // ── Check for Gmail callback signal ───────────────────────────────
  // The callback route stores the token in an httpOnly cookie and redirects
  // with ?gmail_ready=1 as a signal (no sensitive data in the URL).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.get("gmail_ready") === "1") {
      // Clean the URL
      window.history.replaceState({}, "", "/gmail-connect");
      // Token is in the httpOnly cookie — call the API directly
      fetchInsights();
    }

    // Handle error redirects from the callback
    const callbackError = params.get("error");
    if (callbackError) {
      window.history.replaceState({}, "", "/gmail-connect");
      if (callbackError === "csrf_mismatch") {
        setError("Security check failed. Please try again.");
      } else {
        setError("Failed to connect Gmail. Please try again.");
      }
      setPhase("error");
    }
  }, []);

  // ── Fetch insights from API ───────────────────────────────────────
  // The Gmail access token is read from the httpOnly cookie server-side —
  // the frontend never sees or sends the token.
  const fetchInsights = useCallback(async () => {
    setPhase("loading");
    setProgress(0);

    // Simulated progress while waiting
    const progressInterval = setInterval(() => {
      setProgress((p) => Math.min(p + 2, 85));
    }, 200);

    try {
      const res = await fetch("/api/onboarding/gmail-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      clearInterval(progressInterval);

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to analyze Gmail");
      }

      const data = await res.json();
      setProgress(100);
      setInsights(data.insights);
      setSummary(data.summary);
      setCards(data.cards);

      // Brief pause to show 100% then transition to insights
      setTimeout(() => {
        setPhase("insights");
        setCurrentInsight(0);
      }, 500);
    } catch (err) {
      clearInterval(progressInterval);
      setError(err instanceof Error ? err.message : "Something went wrong");
      setPhase("error");
    }
  }, []);

  // ── Animate insights one by one ───────────────────────────────────
  useEffect(() => {
    if (phase !== "insights") return;
    if (currentInsight >= insights.length) {
      // All insights shown — move to summary after a brief pause
      const timer = setTimeout(() => setPhase("summary"), 1000);
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(() => {
      setCurrentInsight((c) => c + 1);
    }, 1500);

    return () => clearTimeout(timer);
  }, [phase, currentInsight, insights.length]);

  // ── Handle Connect Gmail ──────────────────────────────────────────
  function handleConnect() {
    window.location.href = buildGmailOAuthUrl();
  }

  // ── Handle Skip ───────────────────────────────────────────────────
  function handleSkip() {
    router.push("/connect");
  }

  // ── Handle Continue (after summary) ───────────────────────────────
  function handleContinue() {
    router.push("/connect");
  }

  return (
    <div
      className="min-h-screen flex flex-col relative overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #dbeafe 0%, #fce7f3 40%, #d1fae5 100%)",
      }}
    >
      {/* Inline keyframes */}
      <style jsx global>{`
        @keyframes float-1 {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          33% { transform: translateY(-12px) translateX(6px); }
          66% { transform: translateY(6px) translateX(-4px); }
        }
        @keyframes float-2 {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          33% { transform: translateY(8px) translateX(-8px); }
          66% { transform: translateY(-10px) translateX(4px); }
        }
        @keyframes float-3 {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          33% { transform: translateY(-8px) translateX(-6px); }
          66% { transform: translateY(12px) translateX(8px); }
        }
        @keyframes float-4 {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          33% { transform: translateY(10px) translateX(4px); }
          66% { transform: translateY(-6px) translateX(-10px); }
        }
      `}</style>

      {/* ── Floating bubbles (always visible) ──────────────────────── */}
      <div className="absolute top-20 left-0 right-0 flex justify-center gap-6 z-0 pointer-events-none">
        {BUBBLE_COLORS.map((bg, i) => (
          <div
            key={i}
            className="w-10 h-10 rounded-full relative"
            style={{
              background: bg,
              boxShadow: BUBBLE_SHADOWS[i],
              animation: `float-${i + 1} ${3 + i * 0.5}s ease-in-out infinite`,
            }}
          >
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background:
                  "radial-gradient(circle at 30% 25%, rgba(255,255,255,0.5) 0%, transparent 50%)",
              }}
            />
          </div>
        ))}
      </div>

      {/* ── Main content ───────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 z-10">
        <AnimatePresence mode="wait">
          {/* ── PROMPT PHASE ─────────────────────────────────────── */}
          {phase === "prompt" && (
            <motion.div
              key="prompt"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="text-center max-w-md mx-auto"
            >
              {/* Gmail icon */}
              <div className="mb-8">
                <svg
                  width="64"
                  height="64"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="mx-auto"
                >
                  <path
                    d="M20 18H18V9.25L12 13L6 9.25V18H4V6H5.2L12 10.5L18.8 6H20V18Z"
                    fill="#EA4335"
                  />
                  <path d="M4 6L12 13L20 6" stroke="#EA4335" strokeWidth="0" />
                  <rect
                    x="2"
                    y="4"
                    width="20"
                    height="16"
                    rx="2"
                    stroke="#EA4335"
                    strokeWidth="1.5"
                    fill="none"
                  />
                </svg>
              </div>

              <h1
                className="text-3xl mb-4"
                style={{
                  fontFamily: "var(--font-serif)",
                  color: "#333334",
                  fontWeight: 400,
                }}
              >
                Your agent wants to get to know you
              </h1>

              <p
                className="text-base mb-8 leading-relaxed"
                style={{ color: "#666" }}
              >
                We use your Gmail to truly get to know you.
                <br />
                Connect now to get started.
              </p>

              <button
                onClick={handleConnect}
                className="w-full max-w-xs mx-auto px-8 py-4 rounded-xl text-base font-semibold transition-all"
                style={{
                  background:
                    "linear-gradient(-75deg, #c75a34, #DC6743, #e8845e, #DC6743, #c75a34)",
                  boxShadow: `
                    rgba(255,255,255,0.2) 0px 2px 2px 0px inset,
                    rgba(255,255,255,0.3) 0px -1px 1px 0px inset,
                    rgba(220,103,67,0.35) 0px 4px 16px 0px,
                    rgba(255,255,255,0.08) 0px 0px 1.6px 4px inset
                  `,
                  color: "#ffffff",
                }}
              >
                Connect Gmail
              </button>

              <p
                className="text-xs mt-6 leading-relaxed max-w-xs mx-auto"
                style={{ color: "#999" }}
              >
                Your data stays private and is only used to personalize your
                agent.
              </p>

              <button
                onClick={handleSkip}
                className="mt-6 text-sm underline underline-offset-4 transition-opacity hover:opacity-70"
                style={{ color: "#999" }}
              >
                Skip for now
              </button>
            </motion.div>
          )}

          {/* ── LOADING PHASE ────────────────────────────────────── */}
          {phase === "loading" && (
            <motion.div
              key="loading"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="text-center max-w-md mx-auto"
            >
              <h2
                className="text-2xl mb-6"
                style={{
                  fontFamily: "var(--font-serif)",
                  color: "#333334",
                  fontWeight: 400,
                }}
              >
                Figuring you out...
              </h2>

              <p className="text-sm mb-8" style={{ color: "#666" }}>
                Reading your inbox patterns (metadata only, never full emails)
              </p>

              {/* Progress bar */}
              <div className="w-full max-w-xs mx-auto">
                <div
                  className="h-2 rounded-full overflow-hidden"
                  style={{
                    background: "rgba(255,255,255,0.4)",
                    boxShadow: "inset 0 1px 2px rgba(0,0,0,0.05)",
                  }}
                >
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      background:
                        "linear-gradient(90deg, #c75a34, #DC6743, #e8845e)",
                    }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  />
                </div>
                <p className="text-xs mt-2" style={{ color: "#999" }}>
                  {progress}%
                </p>
              </div>
            </motion.div>
          )}

          {/* ── INSIGHTS PHASE ───────────────────────────────────── */}
          {phase === "insights" && (
            <motion.div
              key="insights"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="text-center max-w-lg mx-auto w-full"
            >
              {/* Progress dots */}
              <div className="flex justify-center gap-2 mb-12">
                {insights.map((_, i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full transition-all duration-300"
                    style={{
                      background:
                        i <= currentInsight
                          ? "#DC6743"
                          : "rgba(255,255,255,0.4)",
                      boxShadow:
                        i === currentInsight
                          ? "0 0 8px rgba(220,103,67,0.5)"
                          : "none",
                      transform:
                        i === currentInsight ? "scale(1.3)" : "scale(1)",
                    }}
                  />
                ))}
              </div>

              {/* Current insight */}
              <div className="min-h-[80px] flex items-center justify-center">
                <AnimatePresence mode="wait">
                  {currentInsight < insights.length && (
                    <motion.p
                      key={currentInsight}
                      initial={{ opacity: 0, y: 20, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -20, scale: 0.95 }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                      className="text-3xl font-medium tracking-tight"
                      style={{
                        fontFamily: "var(--font-serif)",
                        color: "#333334",
                      }}
                    >
                      {insights[currentInsight]}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              {/* Progress bar */}
              <div className="w-full max-w-xs mx-auto mt-12">
                <div
                  className="h-1.5 rounded-full overflow-hidden"
                  style={{
                    background: "rgba(255,255,255,0.4)",
                  }}
                >
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      background:
                        "linear-gradient(90deg, #c75a34, #DC6743, #e8845e)",
                    }}
                    animate={{
                      width: `${((currentInsight + 1) / insights.length) * 100}%`,
                    }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* ── SUMMARY PHASE ────────────────────────────────────── */}
          {phase === "summary" && (
            <motion.div
              key="summary"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="w-full max-w-lg mx-auto"
            >
              <h2
                className="text-2xl text-center mb-8"
                style={{
                  fontFamily: "var(--font-serif)",
                  color: "#333334",
                  fontWeight: 400,
                }}
              >
                Here&apos;s what your agent already knows about you
              </h2>

              {/* Cards grid */}
              <div className="grid grid-cols-2 gap-3 mb-10">
                {cards.map((card, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.15, duration: 0.4 }}
                    className="rounded-xl p-5"
                    style={{
                      background:
                        "linear-gradient(-75deg, rgba(255,255,255,0.4), rgba(255,255,255,0.7), rgba(255,255,255,0.4))",
                      backdropFilter: "blur(8px)",
                      WebkitBackdropFilter: "blur(8px)",
                      boxShadow: `
                        rgba(0, 0, 0, 0.03) 0px 2px 2px 0px inset,
                        rgba(255, 255, 255, 0.6) 0px -2px 2px 0px inset,
                        rgba(0, 0, 0, 0.06) 0px 2px 8px 0px
                      `,
                    }}
                  >
                    {/* Bubble icon */}
                    <div
                      className="w-8 h-8 rounded-full mb-3 relative overflow-hidden"
                      style={{
                        background: BUBBLE_COLORS[i % BUBBLE_COLORS.length],
                        boxShadow: BUBBLE_SHADOWS[i % BUBBLE_SHADOWS.length],
                      }}
                    >
                      <div
                        className="absolute inset-0 rounded-full"
                        style={{
                          background:
                            "radial-gradient(circle at 30% 25%, rgba(255,255,255,0.5) 0%, transparent 50%)",
                        }}
                      />
                    </div>

                    <h3
                      className="text-sm font-semibold mb-1"
                      style={{ color: "#333334" }}
                    >
                      {card.title}
                    </h3>
                    <p className="text-xs leading-relaxed" style={{ color: "#666" }}>
                      {card.description}
                    </p>
                  </motion.div>
                ))}
              </div>

              <button
                onClick={handleContinue}
                className="w-full px-6 py-3.5 rounded-xl text-base font-semibold transition-all"
                style={{
                  background:
                    "linear-gradient(-75deg, #c75a34, #DC6743, #e8845e, #DC6743, #c75a34)",
                  boxShadow: `
                    rgba(255,255,255,0.2) 0px 2px 2px 0px inset,
                    rgba(255,255,255,0.3) 0px -1px 1px 0px inset,
                    rgba(220,103,67,0.35) 0px 4px 16px 0px,
                    rgba(255,255,255,0.08) 0px 0px 1.6px 4px inset
                  `,
                  color: "#ffffff",
                }}
              >
                Next
              </button>
            </motion.div>
          )}

          {/* ── ERROR PHASE ──────────────────────────────────────── */}
          {phase === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="text-center max-w-md mx-auto"
            >
              <h2
                className="text-2xl mb-4"
                style={{
                  fontFamily: "var(--font-serif)",
                  color: "#333334",
                  fontWeight: 400,
                }}
              >
                Something went wrong
              </h2>

              <p className="text-sm mb-6" style={{ color: "#666" }}>
                {error}
              </p>

              <div className="flex flex-col gap-3 max-w-xs mx-auto">
                <button
                  onClick={() => {
                    setPhase("prompt");
                    setError("");
                  }}
                  className="px-6 py-3 rounded-xl text-base font-semibold transition-all"
                  style={{
                    background:
                      "linear-gradient(-75deg, #c75a34, #DC6743, #e8845e, #DC6743, #c75a34)",
                    boxShadow:
                      "rgba(255,255,255,0.2) 0px 2px 2px 0px inset, rgba(255,255,255,0.3) 0px -1px 1px 0px inset, rgba(220,103,67,0.35) 0px 4px 16px 0px",
                    color: "#ffffff",
                  }}
                >
                  Try Again
                </button>

                <button
                  onClick={handleSkip}
                  className="text-sm underline underline-offset-4 transition-opacity hover:opacity-70"
                  style={{ color: "#999" }}
                >
                  Skip for now
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
