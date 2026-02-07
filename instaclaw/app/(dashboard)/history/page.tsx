"use client";

import { useState, useEffect } from "react";
import { MessageSquare, ChevronRight, ArrowLeft } from "lucide-react";

interface Session {
  id: string;
  preview: string;
  date: string;
}

interface Message {
  role: string;
  content: string;
}

export default function HistoryPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  useEffect(() => {
    fetch("/api/vm/conversations")
      .then((r) => r.json())
      .then((data) => {
        setSessions(data.sessions ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function loadSession(sessionId: string) {
    setSelectedSession(sessionId);
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/vm/conversations?sessionId=${sessionId}`);
      const data = await res.json();
      setMessages(data.messages ?? []);
    } catch {
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Conversation History</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          View past conversations with your bot.
        </p>
      </div>

      {loading ? (
        <div className="glass rounded-xl p-8 text-center">
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Loading conversations...
          </p>
        </div>
      ) : selectedSession ? (
        /* Conversation detail view */
        <div className="space-y-4">
          <button
            onClick={() => {
              setSelectedSession(null);
              setMessages([]);
            }}
            className="flex items-center gap-1.5 text-sm cursor-pointer transition-colors"
            style={{ color: "var(--muted)" }}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to conversations
          </button>

          {loadingMessages ? (
            <div className="glass rounded-xl p-8 text-center">
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                Loading messages...
              </p>
            </div>
          ) : messages.length === 0 ? (
            <div className="glass rounded-xl p-8 text-center">
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                No messages in this conversation.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className="glass rounded-xl p-4"
                  style={{
                    border: "1px solid var(--border)",
                    borderLeft: `3px solid ${
                      msg.role === "user" ? "#3b82f6" : "var(--success)"
                    }`,
                  }}
                >
                  <p
                    className="text-xs font-medium mb-1 uppercase"
                    style={{
                      color:
                        msg.role === "user" ? "#3b82f6" : "var(--success)",
                    }}
                  >
                    {msg.role}
                  </p>
                  <p
                    className="text-sm whitespace-pre-wrap"
                    style={{ color: "var(--foreground)" }}
                  >
                    {typeof msg.content === "string"
                      ? msg.content
                      : JSON.stringify(msg.content)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : sessions.length === 0 ? (
        <div className="glass rounded-xl p-8 text-center">
          <MessageSquare className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--muted)" }} />
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            No conversations yet. Start chatting with your bot!
          </p>
        </div>
      ) : (
        /* Conversation list */
        <div className="space-y-2">
          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => loadSession(session.id)}
              className="w-full glass rounded-xl p-4 flex items-center gap-3 text-left transition-all hover:border-white/30 cursor-pointer"
              style={{ border: "1px solid var(--border)" }}
            >
              <MessageSquare className="w-4 h-4 shrink-0" style={{ color: "var(--muted)" }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">
                  {session.preview || "Empty conversation"}
                </p>
                {session.date && (
                  <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                    {new Date(session.date).toLocaleString()}
                  </p>
                )}
              </div>
              <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--muted)" }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
