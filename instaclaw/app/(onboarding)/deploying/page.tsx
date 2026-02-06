"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Check, AlertCircle, RotateCcw } from "lucide-react";

type StepStatus = "pending" | "active" | "done" | "error";

interface DeployStep {
  id: string;
  label: string;
  status: StepStatus;
  messages: string[];
}

const MAX_POLL_ATTEMPTS = 90; // 3 minutes at 2s intervals

const STEP_MESSAGES: Record<string, string[]> = {
  payment: [
    "Wrangling payment...",
    "Lassoing your card...",
    "Counting coins...",
    "Shaking hands on the deal...",
  ],
  assign: [
    "Saddling up a server...",
    "Corralling hardware...",
    "Branding your VM...",
    "Staking a claim...",
  ],
  configure: [
    "Taming the claw...",
    "Teaching your bot manners...",
    "Herding containers...",
    "Canoodling with configs...",
  ],
  telegram: [
    "Whispering to Telegram...",
    "Sending smoke signals...",
    "Establishing contact...",
    "Tipping the hat...",
  ],
  health: [
    "Kicking the tires...",
    "Checking vitals...",
    "Poking the server...",
    "Almost there, partner...",
  ],
};

function ShimmerText({ children }: { children: React.ReactNode }) {
  return (
    <span className="shimmer-text font-semibold text-base">{children}</span>
  );
}

function RotatingMessage({ messages }: { messages: string[] }) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((i) => (i + 1) % messages.length);
        setVisible(true);
      }, 300);
    }, 3000);
    return () => clearInterval(interval);
  }, [messages.length]);

  return (
    <ShimmerText>
      <span
        className="inline-block transition-all duration-300"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(4px)",
        }}
      >
        {messages[index]}
      </span>
    </ShimmerText>
  );
}

export default function DeployingPage() {
  const router = useRouter();
  const [steps, setSteps] = useState<DeployStep[]>([
    { id: "payment", label: "Payment confirmed", status: "done", messages: STEP_MESSAGES.payment },
    { id: "assign", label: "Assigning server", status: "active", messages: STEP_MESSAGES.assign },
    { id: "configure", label: "Configuring OpenClaw", status: "pending", messages: STEP_MESSAGES.configure },
    { id: "telegram", label: "Connecting Telegram bot", status: "pending", messages: STEP_MESSAGES.telegram },
    { id: "health", label: "Health check", status: "pending", messages: STEP_MESSAGES.health },
  ]);
  const [configureFailed, setConfigureFailed] = useState(false);
  const [configureAttempts, setConfigureAttempts] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const [pollCount, setPollCount] = useState(0);
  const [polling, setPolling] = useState(true);
  const [justCompleted, setJustCompleted] = useState<Set<string>>(new Set());
  const completedRef = useRef<Set<string>>(new Set(["payment"]));

  const updateStep = useCallback(
    (id: string, status: StepStatus) => {
      setSteps((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status } : s))
      );
      if (status === "done" && !completedRef.current.has(id)) {
        completedRef.current.add(id);
        setJustCompleted((prev) => new Set(prev).add(id));
        setTimeout(() => {
          setJustCompleted((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        }, 800);
      }
    },
    []
  );

  const doneCount = steps.filter((s) => s.status === "done").length;
  const progress = (doneCount / steps.length) * 100;

  // Polling effect
  useEffect(() => {
    if (!polling) return;

    const interval = setInterval(async () => {
      setPollCount((c) => {
        const next = c + 1;
        if (next >= MAX_POLL_ATTEMPTS) {
          setPolling(false);
          setConfigureFailed(true);
          setSteps((prev) =>
            prev.map((s) =>
              s.status === "active" || s.status === "pending"
                ? { ...s, status: "error" }
                : s
            )
          );
        }
        return next;
      });

      try {
        const res = await fetch("/api/vm/status");
        const data = await res.json();

        if (data.status === "assigned" && data.vm) {
          updateStep("assign", "done");

          if (data.vm.healthStatus === "configure_failed") {
            setConfigureFailed(true);
            setConfigureAttempts(data.vm.configureAttempts ?? 0);
            setPolling(false);
            updateStep("configure", "error");
            return;
          }

          if (data.vm.gatewayUrl) {
            updateStep("configure", "done");
            updateStep("telegram", "done");
          } else {
            updateStep("configure", "active");
          }

          if (data.vm.healthStatus === "healthy") {
            updateStep("configure", "done");
            updateStep("telegram", "done");
            updateStep("health", "done");
            setPolling(false);
            clearInterval(interval);
            setTimeout(() => router.push("/dashboard"), 1500);
          }
        } else if (data.status === "pending") {
          updateStep("assign", "active");
        }
      } catch {
        // Continue polling
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [router, updateStep, polling]);

  async function handleRetry() {
    setRetrying(true);
    setConfigureFailed(false);

    setSteps([
      { id: "payment", label: "Payment confirmed", status: "done", messages: STEP_MESSAGES.payment },
      { id: "assign", label: "Assigning server", status: "done", messages: STEP_MESSAGES.assign },
      { id: "configure", label: "Configuring OpenClaw", status: "active", messages: STEP_MESSAGES.configure },
      { id: "telegram", label: "Connecting Telegram bot", status: "pending", messages: STEP_MESSAGES.telegram },
      { id: "health", label: "Health check", status: "pending", messages: STEP_MESSAGES.health },
    ]);

    try {
      const res = await fetch("/api/vm/retry-configure", { method: "POST" });
      const data = await res.json();

      if (res.ok && data.retried) {
        setPollCount(0);
        setPolling(true);
      } else {
        setConfigureFailed(true);
        setConfigureAttempts((prev) => prev + 1);
        updateStep("configure", "error");
      }
    } catch {
      setConfigureFailed(true);
      updateStep("configure", "error");
    } finally {
      setRetrying(false);
    }
  }

  const maxAttemptsReached = configureAttempts >= 3;

  return (
    <>
      <style jsx global>{`
        @keyframes shimmer {
          0% { background-position: 200% center; }
          100% { background-position: -200% center; }
        }
        @keyframes pulse-glow {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
        @keyframes step-complete {
          0% { transform: scale(0.8); opacity: 0; }
          50% { transform: scale(1.15); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes progress-glow {
          0%, 100% { box-shadow: 0 0 8px rgba(249, 115, 22, 0.3); }
          50% { box-shadow: 0 0 16px rgba(249, 115, 22, 0.6); }
        }
        .shimmer-text {
          background: linear-gradient(90deg, #f97316, #fbbf24, #f97316);
          background-size: 200% auto;
          animation: shimmer 2s linear infinite;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .step-appear {
          animation: step-complete 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .active-dot {
          animation: pulse-glow 2s ease-in-out infinite;
        }
      `}</style>

      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        {/* Title */}
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight">
            Deploying Your Instance
          </h1>
          <p
            className="text-sm mt-2 opacity-50"
            style={{ color: "var(--muted)" }}
          >
            Setting up your dedicated OpenClaw VM
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-full max-w-md mb-10">
          <div
            className="h-1 rounded-full overflow-hidden"
            style={{ background: "rgba(255,255,255,0.08)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${progress}%`,
                background: "linear-gradient(90deg, #f97316, #fbbf24)",
                animation: progress > 0 && progress < 100 ? "progress-glow 2s ease-in-out infinite" : "none",
              }}
            />
          </div>
        </div>

        {/* Steps */}
        <div className="w-full max-w-md space-y-6">
          {steps.map((step) => (
            <div
              key={step.id}
              className="flex items-center gap-4"
              style={{ minHeight: "32px" }}
            >
              {/* Icon */}
              <div className="w-7 h-7 flex items-center justify-center flex-shrink-0">
                {step.status === "done" && (
                  <div className={justCompleted.has(step.id) ? "step-appear" : ""}>
                    <Check
                      className="w-5 h-5"
                      style={{ color: "#22c55e" }}
                      strokeWidth={3}
                    />
                  </div>
                )}
                {step.status === "active" && (
                  <div
                    className="w-2.5 h-2.5 rounded-full active-dot"
                    style={{ background: "#f97316" }}
                  />
                )}
                {step.status === "pending" && (
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ background: "rgba(255,255,255,0.15)" }}
                  />
                )}
                {step.status === "error" && (
                  <AlertCircle
                    className="w-5 h-5"
                    style={{ color: "#ef4444" }}
                  />
                )}
              </div>

              {/* Label */}
              <div className="flex-1">
                {step.status === "active" ? (
                  <RotatingMessage messages={step.messages} />
                ) : (
                  <span
                    className="text-base font-medium transition-colors duration-500"
                    style={{
                      color:
                        step.status === "done"
                          ? "#22c55e"
                          : step.status === "error"
                          ? "#ef4444"
                          : "rgba(255,255,255,0.25)",
                    }}
                  >
                    {step.label}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Error state with retry */}
        {configureFailed && !retrying && (
          <div
            className="mt-10 rounded-xl p-6 max-w-md w-full space-y-4 border"
            style={{
              background: "rgba(255,255,255,0.03)",
              borderColor: "rgba(239,68,68,0.2)",
            }}
          >
            {maxAttemptsReached ? (
              <>
                <p
                  className="text-sm font-semibold"
                  style={{ color: "#ef4444" }}
                >
                  Configuration failed after multiple attempts.
                </p>
                <p className="text-sm" style={{ color: "var(--muted)" }}>
                  Please contact support at{" "}
                  <a
                    href="mailto:cooper@clawlancer.com"
                    className="underline hover:opacity-80 transition-opacity"
                    style={{ color: "#f97316" }}
                  >
                    cooper@clawlancer.com
                  </a>{" "}
                  and we&apos;ll get your instance running.
                </p>
              </>
            ) : (
              <>
                <p
                  className="text-sm font-semibold"
                  style={{ color: "#ef4444" }}
                >
                  Configuration hit a snag.
                </p>
                <p className="text-sm" style={{ color: "var(--muted)" }}>
                  This sometimes happens during initial setup. Retrying usually
                  fixes it.
                </p>
                <button
                  onClick={handleRetry}
                  className="w-full px-4 py-3 rounded-lg text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
                  style={{
                    background: "linear-gradient(90deg, #f97316, #fbbf24)",
                    color: "#000",
                  }}
                >
                  <RotateCcw className="w-4 h-4" />
                  Retry Configuration
                </button>
              </>
            )}
          </div>
        )}

        {/* Retrying state */}
        {retrying && (
          <div className="mt-10">
            <ShimmerText>Retrying configuration...</ShimmerText>
          </div>
        )}
      </div>
    </>
  );
}
