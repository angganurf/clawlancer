"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const tiers = [
  {
    id: "starter" as const,
    name: "Starter",
    allInclusive: 29,
    byok: 14,
    description: "Perfect for personal use",
    features: ["Full OpenClaw instance", "Dedicated VM", "Telegram integration"],
    trial: true,
  },
  {
    id: "pro" as const,
    name: "Pro",
    allInclusive: 79,
    byok: 39,
    description: "For power users",
    features: ["Everything in Starter", "More CPU & RAM", "Priority support"],
    popular: true,
    trial: true,
  },
  {
    id: "power" as const,
    name: "Power",
    allInclusive: 199,
    byok: 99,
    description: "Maximum performance",
    features: ["Everything in Pro", "Top-tier resources", "Dedicated support"],
    trial: true,
  },
];

export default function PlanPage() {
  const router = useRouter();
  const [selectedTier, setSelectedTier] = useState<string>("pro");
  const [apiMode, setApiMode] = useState<"all_inclusive" | "byok">(
    "all_inclusive"
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const stored = sessionStorage.getItem("instaclaw_onboarding");
    if (!stored) {
      router.push("/connect");
      return;
    }
    const data = JSON.parse(stored);
    setApiMode(data.apiMode ?? "all_inclusive");
  }, [router]);

  function handleToggleApiMode() {
    const newMode = apiMode === "all_inclusive" ? "byok" : "all_inclusive";
    setApiMode(newMode);

    // Sync back to sessionStorage
    const stored = sessionStorage.getItem("instaclaw_onboarding");
    if (stored) {
      const data = JSON.parse(stored);
      data.apiMode = newMode;
      sessionStorage.setItem("instaclaw_onboarding", JSON.stringify(data));
    }
  }

  async function handleCheckout() {
    setLoading(true);
    setError("");

    // Store tier selection
    const stored = sessionStorage.getItem("instaclaw_onboarding");
    if (stored) {
      const data = JSON.parse(stored);
      data.tier = selectedTier;
      data.apiMode = apiMode;
      sessionStorage.setItem("instaclaw_onboarding", JSON.stringify(data));
    }

    // Save pending user config to database before checkout
    try {
      const onboarding = JSON.parse(
        sessionStorage.getItem("instaclaw_onboarding") ?? "{}"
      );

      const saveRes = await fetch("/api/onboarding/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botToken: onboarding.botToken,
          discordToken: onboarding.discordToken,
          channels: onboarding.channels,
          apiMode,
          apiKey: onboarding.apiKey,
          tier: selectedTier,
        }),
      });

      if (!saveRes.ok) {
        const err = await saveRes.json();
        setLoading(false);
        setError(err.error || "Failed to save configuration. Please try again.");
        return;
      }
    } catch {
      setLoading(false);
      setError("Network error saving configuration. Please try again.");
      return;
    }

    // Create Stripe checkout
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier: selectedTier,
          apiMode,
          trial: true,
        }),
      });
      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        setLoading(false);
        setError(data.error || "Failed to create checkout session. Please try again.");
      }
    } catch {
      setLoading(false);
      setError("Network error creating checkout. Please try again.");
    }
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Choose Your Plan</h1>
        <p className="text-sm mt-2" style={{ color: "var(--muted)" }}>
          All plans include a full OpenClaw instance on a dedicated VM.
        </p>

        {/* BYOK toggle */}
        <div className="inline-flex items-center gap-3 text-sm mt-4">
          <span style={{ color: apiMode === "byok" ? "var(--muted)" : "#ffffff" }}>
            All-Inclusive
          </span>
          <button
            type="button"
            onClick={handleToggleApiMode}
            className="relative w-12 h-6 rounded-full transition-colors cursor-pointer"
            style={{
              background: apiMode === "byok" ? "#ffffff" : "rgba(255, 255, 255, 0.15)",
            }}
          >
            <span
              className="absolute top-1 w-4 h-4 rounded-full transition-all duration-200"
              style={{
                background: apiMode === "byok" ? "#000000" : "#ffffff",
                left: apiMode === "byok" ? "28px" : "4px",
              }}
            />
          </button>
          <span style={{ color: apiMode === "byok" ? "#ffffff" : "var(--muted)" }}>
            BYOK
          </span>
        </div>
        {apiMode === "byok" && (
          <p className="text-xs mt-2" style={{ color: "var(--muted)" }}>
            Bring Your Own Anthropic API Key — lower monthly cost, you pay Anthropic directly.
          </p>
        )}
      </div>

      <div className="space-y-3">
        {tiers.map((tier) => {
          const price =
            apiMode === "byok" ? tier.byok : tier.allInclusive;

          return (
            <button
              key={tier.id}
              type="button"
              onClick={() => setSelectedTier(tier.id)}
              className="w-full glass rounded-xl p-5 text-left transition-all cursor-pointer relative"
              style={{
                border:
                  selectedTier === tier.id
                    ? "1px solid #ffffff"
                    : "1px solid var(--border)",
                boxShadow:
                  selectedTier === tier.id
                    ? "0 0 20px rgba(255,255,255,0.08)"
                    : undefined,
              }}
            >
              {tier.popular && (
                <span
                  className="absolute -top-2.5 right-4 px-2 py-0.5 rounded-full text-xs font-semibold"
                  style={{ background: "#ffffff", color: "#000000" }}
                >
                  Popular
                </span>
              )}
              {tier.trial && (
                <span
                  className="absolute -top-2.5 left-4 px-2 py-0.5 rounded-full text-xs font-semibold"
                  style={{ background: "#3b82f6", color: "#ffffff" }}
                >
                  7-Day Free Trial
                </span>
              )}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{tier.name}</p>
                  <p
                    className="text-xs mt-0.5"
                    style={{ color: "var(--muted)" }}
                  >
                    {tier.description}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold">${price}</span>
                  <span
                    className="text-sm"
                    style={{ color: "var(--muted)" }}
                  >
                    /mo
                  </span>
                  {tier.trial && (
                    <p className="text-xs" style={{ color: "#3b82f6" }}>
                      Free for 7 days
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-3 mt-3 flex-wrap">
                {tier.features.map((f) => (
                  <span
                    key={f}
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      color: "var(--muted)",
                    }}
                  >
                    {f}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {error && (
        <p className="text-sm text-center" style={{ color: "#ef4444" }}>
          {error}
        </p>
      )}

      <button
        onClick={handleCheckout}
        disabled={loading}
        className="w-full px-6 py-3 rounded-lg text-sm font-semibold transition-all cursor-pointer disabled:opacity-50 hover:shadow-[0_0_20px_rgba(255,255,255,0.2)]"
        style={{ background: "#ffffff", color: "#000000" }}
      >
        {loading ? "Redirecting to checkout..." : "Start Free Trial"}
      </button>
    </div>
  );
}
