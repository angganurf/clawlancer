"use client";

import { useState, useEffect } from "react";
import { Clock, Plus, Trash2 } from "lucide-react";

export default function ScheduledPage() {
  const [entries, setEntries] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [schedule, setSchedule] = useState("");
  const [command, setCommand] = useState("");
  const [description, setDescription] = useState("");
  const [adding, setAdding] = useState(false);

  async function fetchTasks() {
    try {
      const res = await fetch("/api/vm/scheduled-tasks");
      const data = await res.json();
      setEntries(data.entries ?? []);
    } catch {
      // Silently handle
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTasks();
  }, []);

  async function handleAdd() {
    if (!schedule.trim() || !command.trim()) return;
    setAdding(true);
    try {
      await fetch("/api/vm/scheduled-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          schedule: schedule.trim(),
          command: command.trim(),
          description: description.trim() || undefined,
        }),
      });
      setSchedule("");
      setCommand("");
      setDescription("");
      setShowAdd(false);
      await fetchTasks();
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(entry: string) {
    // Extract command part (after the cron schedule, which is 5 fields)
    const parts = entry.trim().split(/\s+/);
    const cmd = parts.slice(5).join(" ");
    if (!cmd) return;

    await fetch("/api/vm/scheduled-tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove", command: cmd }),
    });
    await fetchTasks();
  }

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl sm:text-4xl font-normal tracking-[-0.5px]" style={{ fontFamily: "var(--font-serif)" }}>Scheduled Tasks</h1>
          <p className="text-base mt-2" style={{ color: "var(--muted)" }}>
            Manage cron jobs on your VM.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors"
          style={{
            background: "#ffffff",
            color: "#000000",
          }}
        >
          <Plus className="w-3 h-3" />
          Add Task
        </button>
      </div>

      {showAdd && (
        <div className="glass rounded-xl p-5 space-y-3" style={{ border: "1px solid var(--border)" }}>
          <input
            type="text"
            placeholder="Cron schedule (e.g. */30 * * * *)"
            value={schedule}
            onChange={(e) => setSchedule(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm font-mono outline-none"
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
            }}
          />
          <input
            type="text"
            placeholder="Command (e.g. openclaw run 'check my emails')"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm font-mono outline-none"
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
            }}
          />
          <input
            type="text"
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
            }}
          />
          <button
            onClick={handleAdd}
            disabled={adding || !schedule.trim() || !command.trim()}
            className="px-4 py-2 rounded-lg text-xs font-medium cursor-pointer disabled:opacity-50"
            style={{ background: "#ffffff", color: "#000000" }}
          >
            {adding ? "Adding..." : "Add Task"}
          </button>
        </div>
      )}

      {loading ? (
        <div className="glass rounded-xl p-8 text-center">
          <p className="text-sm" style={{ color: "var(--muted)" }}>Loading...</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="glass rounded-xl p-8 text-center">
          <Clock className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--muted)" }} />
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            No scheduled tasks. Add one to automate your bot.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries
            .filter((e) => e.trim() && !e.startsWith("#"))
            .map((entry, i) => (
              <div
                key={i}
                className="glass rounded-xl p-4 flex items-center gap-3"
                style={{ border: "1px solid var(--border)" }}
              >
                <Clock className="w-4 h-4 shrink-0" style={{ color: "var(--muted)" }} />
                <code className="text-xs flex-1 font-mono truncate">{entry}</code>
                <button
                  onClick={() => handleRemove(entry)}
                  className="cursor-pointer shrink-0 p-1 rounded transition-colors hover:bg-white/5"
                  style={{ color: "var(--error)" }}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
