"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface VM {
  id: string;
  ip_address: string;
  status: string;
  health_status: string;
  assigned_to: string | null;
  region: string | null;
  gateway_url: string | null;
  control_ui_url: string | null;
  channels_enabled: string[] | null;
  created_at: string;
  last_health_check: string | null;
}

interface UserInfo {
  id: string;
  email: string;
  name: string | null;
  created_at: string;
}

interface Subscription {
  id: string;
  user_id: string;
  tier: string;
  status: string;
  payment_status: string;
  stripe_subscription_id: string | null;
}

export default function AdminVMDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [vm, setVM] = useState<VM | null>(null);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/vms/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      setVM(data.vm);
      setUser(data.user);
      setSubscription(data.subscription);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleAction(action: string) {
    if (action === "destroy") {
      if (!confirm("Are you sure you want to destroy this VM? This cannot be undone.")) return;
    }
    if (action === "reclaim") {
      if (!confirm("Reclaim this VM? It will be unassigned from the current user.")) return;
    }
    if (action === "cancel_subscription") {
      if (!confirm("Cancel this user's subscription? This will stop billing immediately.")) return;
    }

    setActionLoading(action);
    try {
      const body: Record<string, string> = { action, vmId: vm?.id ?? "" };
      if (action === "cancel_subscription" && vm?.assigned_to) {
        body.userId = vm.assigned_to;
      }

      const res = await fetch("/api/admin/vms/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        if (action === "destroy") {
          window.location.href = "/admin/vms";
          return;
        }
        fetchData();
      }
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p style={{ color: "var(--muted)" }}>Loading...</p>
      </div>
    );
  }

  if (!vm) {
    return (
      <div className="space-y-4">
        <Link href="/admin/vms" className="text-sm underline" style={{ color: "var(--muted)" }}>
          Back to VMs
        </Link>
        <p className="text-center py-8" style={{ color: "var(--muted)" }}>
          VM not found.
        </p>
      </div>
    );
  }

  const statusColor = (status: string) => {
    if (status === "ready") return "var(--success)";
    if (status === "assigned") return "#ffffff";
    if (status === "failed") return "var(--error)";
    return "var(--muted)";
  };

  const healthColor = (health: string) => {
    if (health === "healthy") return "var(--success)";
    if (health === "unhealthy") return "var(--error)";
    return "var(--muted)";
  };

  return (
    <div className="space-y-6">
      <Link href="/admin/vms" className="text-sm underline inline-block" style={{ color: "var(--muted)" }}>
        &larr; Back to VMs
      </Link>

      <h1 className="text-2xl font-bold">VM Detail</h1>

      {/* VM Info Card */}
      <div
        className="glass rounded-xl p-6 space-y-4"
        style={{ border: "1px solid var(--border)" }}
      >
        <h2 className="text-lg font-semibold">VM Info</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <Field label="ID" value={vm.id} mono />
          <Field label="IP Address" value={vm.ip_address} mono />
          <Field label="Status">
            <span style={{ color: statusColor(vm.status) }}>{vm.status}</span>
          </Field>
          <Field label="Health">
            <span style={{ color: healthColor(vm.health_status) }}>{vm.health_status}</span>
          </Field>
          <Field label="Region" value={vm.region ?? "---"} />
          <Field label="Assigned To" value={vm.assigned_to ? vm.assigned_to.slice(0, 12) + "..." : "---"} mono />
          <Field label="Gateway URL" value={vm.gateway_url ?? "---"} mono />
          <Field label="Control UI URL" value={vm.control_ui_url ?? "---"} mono />
          <Field
            label="Channels Enabled"
            value={vm.channels_enabled?.join(", ") ?? "---"}
          />
          <Field
            label="Created"
            value={new Date(vm.created_at).toLocaleString()}
          />
          <Field
            label="Last Health Check"
            value={vm.last_health_check ? new Date(vm.last_health_check).toLocaleString() : "---"}
          />
        </div>
      </div>

      {/* Assigned User Card */}
      {user && (
        <div
          className="glass rounded-xl p-6 space-y-4"
          style={{ border: "1px solid var(--border)" }}
        >
          <h2 className="text-lg font-semibold">Assigned User</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <Field label="Email" value={user.email} />
            <Field label="Name" value={user.name ?? "---"} />
            <Field
              label="Joined"
              value={new Date(user.created_at).toLocaleString()}
            />
          </div>
          <Link
            href={`/admin/users/${user.id}`}
            className="text-sm underline inline-block mt-2"
            style={{ color: "var(--muted)" }}
          >
            View User Detail
          </Link>
        </div>
      )}

      {/* Subscription Card */}
      {subscription && (
        <div
          className="glass rounded-xl p-6 space-y-4"
          style={{ border: "1px solid var(--border)" }}
        >
          <h2 className="text-lg font-semibold">Subscription</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <Field label="Tier" value={subscription.tier} />
            <Field label="Status">
              <span
                style={{
                  color:
                    subscription.status === "active"
                      ? "var(--success)"
                      : "var(--error)",
                }}
              >
                {subscription.status}
              </span>
            </Field>
            <Field label="Payment Status">
              <span
                style={{
                  color:
                    subscription.payment_status === "paid"
                      ? "var(--success)"
                      : "var(--error)",
                }}
              >
                {subscription.payment_status}
              </span>
            </Field>
            <Field
              label="Stripe Subscription ID"
              value={subscription.stripe_subscription_id ?? "---"}
              mono
            />
          </div>
        </div>
      )}

      {/* Actions */}
      <div
        className="glass rounded-xl p-6 space-y-4"
        style={{ border: "1px solid var(--border)" }}
      >
        <h2 className="text-lg font-semibold">Actions</h2>
        <div className="flex flex-wrap gap-3">
          <ActionButton
            label="Reconfigure"
            action="reconfigure"
            loading={actionLoading}
            onClick={handleAction}
          />
          <ActionButton
            label="Reclaim VM"
            action="reclaim"
            loading={actionLoading}
            onClick={handleAction}
            variant="warning"
          />
          {subscription && (
            <ActionButton
              label="Cancel Subscription"
              action="cancel_subscription"
              loading={actionLoading}
              onClick={handleAction}
              variant="danger"
            />
          )}
          <ActionButton
            label="Destroy VM"
            action="destroy"
            loading={actionLoading}
            onClick={handleAction}
            variant="danger"
          />
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
  children,
}: {
  label: string;
  value?: string;
  mono?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs mb-1" style={{ color: "var(--muted)" }}>
        {label}
      </p>
      {children ?? (
        <p
          className={mono ? "font-mono text-xs break-all" : ""}
          style={{ color: "var(--foreground)" }}
        >
          {value}
        </p>
      )}
    </div>
  );
}

function ActionButton({
  label,
  action,
  loading,
  onClick,
  variant,
}: {
  label: string;
  action: string;
  loading: string | null;
  onClick: (action: string) => void;
  variant?: "warning" | "danger";
}) {
  const isLoading = loading === action;

  const bg =
    variant === "danger"
      ? "var(--error)"
      : variant === "warning"
      ? "#f59e0b"
      : "#ffffff";

  const color =
    variant === "danger" || variant === "warning" ? "#ffffff" : "#000000";

  return (
    <button
      onClick={() => onClick(action)}
      disabled={loading !== null}
      className="px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-50"
      style={{ background: bg, color }}
    >
      {isLoading ? "Working..." : label}
    </button>
  );
}
