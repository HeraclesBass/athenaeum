"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  api,
  type Library,
  type SourceDetail,
  type ChatResponse,
  type ConversationSummary,
} from "@/lib/api";
import { useKeyboard } from "@/lib/useKeyboard";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: SourceDetail[];
  suggestions?: string[];
}

export default function LibraryChatPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [library, setLibrary] = useState<Library | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [expandedSources, setExpandedSources] = useState<Record<number, boolean>>({});
  const [showHistory, setShowHistory] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const keyHandlers = useMemo(() => ({
    "n": () => { setMessages([]); setConversationId(null); setExpandedSources({}); setShowHistory(false); setTimeout(() => inputRef.current?.focus(), 50); },
    "Escape": () => { if (showHistory) setShowHistory(false); },
    "/": () => inputRef.current?.focus(),
  }), [showHistory]);
  useKeyboard(keyHandlers);

  useEffect(() => {
    api.libraryBySlug(slug).then((lib) => {
      setLibrary(lib);
      api.conversations(lib.id).then(setConversations).catch(() => {});
    });
  }, [slug]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const toggleSource = useCallback((sourceIndex: number) => {
    setExpandedSources((prev) => ({ ...prev, [sourceIndex]: !prev[sourceIndex] }));
  }, []);

  async function loadConversation(convId: string) {
    try {
      const detail = await api.conversation(convId);
      setConversationId(convId);
      setMessages(
        detail.messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
          sources: m.sources_json ?? undefined,
        }))
      );
      setShowHistory(false);
    } catch {}
  }

  function startNewConversation() {
    setMessages([]);
    setConversationId(null);
    setExpandedSources({});
    setShowHistory(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function sendMessage(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || loading || !library) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    setLoading(true);
    setExpandedSources({});

    try {
      const data: ChatResponse = await api.chat(
        library.id,
        msg,
        8,
        conversationId ?? undefined
      );
      if (!conversationId) setConversationId(data.conversation_id);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer,
          sources: data.sources,
          suggestions: data.suggestions,
        },
      ]);
      // Refresh conversation list
      api.conversations(library.id).then(setConversations).catch(() => {});
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : "Something went wrong";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${errMsg}` },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const suggestions = library?.config?.frontend?.suggestions || [
    "What does this document cover?",
    "Summarize the key policies",
    "What are the main sections?",
  ];

  return (
    <div>
      <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">
            {library ? `Chat — ${library.name}` : "Loading..."}
          </h1>
          <p className="text-xs sm:text-sm mt-1" style={{ color: "var(--muted)" }}>
            Research-grade AI answers with source citations
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="btn text-xs"
            style={{
              background: showHistory ? "var(--accent-dim)" : "transparent",
              color: showHistory ? "var(--accent)" : "var(--muted)",
              border: `1px solid ${showHistory ? "rgba(99,162,255,0.3)" : "var(--border)"}`,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            History
          </button>
          <button onClick={startNewConversation} className="btn text-xs" style={{ color: "var(--muted)", border: "1px solid var(--border)" }}>
            + New
          </button>
        </div>
      </div>

      <div className="flex gap-4 relative" style={{ height: "calc(100vh - 12rem)" }}>
        {/* Conversation history sidebar — overlay on mobile, inline on desktop */}
        {showHistory && (
          <>
            <div
              className="fixed inset-0 z-30 md:hidden"
              style={{ background: "rgba(0,0,0,0.5)" }}
              onClick={() => setShowHistory(false)}
            />
            <aside
              className="fixed left-0 top-12 bottom-0 w-64 z-40 md:relative md:top-auto md:bottom-auto md:w-56 shrink-0 rounded-none md:rounded-xl border-r md:border flex flex-col overflow-hidden animate-in"
              style={{ background: "var(--surface)", borderColor: "var(--border)" }}
            >
            <div className="p-3 border-b" style={{ borderColor: "var(--border)" }}>
              <p className="section-label text-xs">Conversations</p>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {conversations.length === 0 ? (
                <p className="text-xs p-2" style={{ color: "var(--muted-2)" }}>No conversations yet</p>
              ) : (
                conversations.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => loadConversation(c.id)}
                    className="w-full text-left px-3 py-2 rounded-lg text-xs transition-colors"
                    style={{
                      background: c.id === conversationId ? "var(--accent-dim)" : "transparent",
                      color: c.id === conversationId ? "var(--accent)" : "var(--muted)",
                    }}
                  >
                    <p className="truncate font-medium" style={{ color: c.id === conversationId ? "var(--text)" : undefined }}>
                      {c.title || "Untitled"}
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: "var(--muted-2)" }}>
                      {c.message_count} messages
                    </p>
                  </button>
                ))
              )}
            </div>
          </aside>
          </>
        )}

        {/* Main chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-5 pr-1">
            {messages.length === 0 && (
              <div className="py-10 text-center animate-in">
                <div
                  className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center text-sm font-bold"
                  style={{
                    background: "var(--accent-dim)",
                    border: "1px solid rgba(99,162,255,0.35)",
                    color: "var(--accent)",
                    boxShadow: "0 0 16px rgba(99,162,255,0.3), 0 0 40px rgba(99,162,255,0.1)",
                  }}
                >
                  AI
                </div>
                <p className="text-xl font-light mb-1" style={{ color: "var(--text)" }}>
                  Ask anything about this library.
                </p>
                <p className="text-sm mb-7" style={{ color: "var(--muted)" }}>
                  {library ? `${library.document_count} documents, ${library.chunk_count} indexed chunks` : ""}
                </p>
                <div className="flex flex-col items-center gap-2">
                  {suggestions.map((s: string) => (
                    <button
                      key={s}
                      onClick={() => sendMessage(s)}
                      className="text-sm px-4 py-2 rounded-full transition-all"
                      style={{
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        color: "var(--muted)",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "rgba(99,162,255,0.35)";
                        e.currentTarget.style.color = "var(--text)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "var(--border)";
                        e.currentTarget.style.color = "var(--muted)";
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className="animate-in">
                {m.role === "user" ? (
                  <div className="flex justify-end">
                    <div
                      className="max-w-2xl rounded-2xl rounded-br px-4 py-3 text-sm leading-relaxed"
                      style={{ background: "var(--accent)", color: "#0a0e14" }}
                    >
                      {m.content}
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2.5">
                    <div
                      className="w-7 h-7 rounded-full shrink-0 mt-1 flex items-center justify-center text-xs font-bold"
                      style={{
                        background: "var(--accent-dim)",
                        border: "1px solid rgba(99,162,255,0.35)",
                        color: "var(--accent)",
                        boxShadow: "0 0 8px rgba(99,162,255,0.3)",
                      }}
                    >
                      AI
                    </div>
                    <div className="flex-1 min-w-0 max-w-3xl">
                      {/* Answer with rendered citations */}
                      <div
                        className="rounded-2xl rounded-bl px-4 py-3 text-sm leading-relaxed"
                        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                      >
                        <RenderedAnswer text={m.content} onCiteClick={toggleSource} />
                      </div>

                      {/* Source cards */}
                      {m.sources && m.sources.length > 0 && (
                        <div className="mt-2 space-y-1.5">
                          <p className="text-[11px] font-medium uppercase tracking-wider px-1" style={{ color: "var(--muted-2)" }}>
                            Sources ({m.sources.length})
                          </p>
                          {m.sources.map((s) => (
                            <SourceCard
                              key={s.index}
                              source={s}
                              expanded={!!expandedSources[s.index]}
                              onToggle={() => toggleSource(s.index)}
                            />
                          ))}
                        </div>
                      )}

                      {/* Follow-up suggestions */}
                      {m.suggestions && m.suggestions.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {m.suggestions.map((s, j) => (
                            <button
                              key={j}
                              onClick={() => sendMessage(s)}
                              className="text-xs px-3 py-1.5 rounded-full transition-all"
                              style={{
                                background: "transparent",
                                border: "1px solid var(--border)",
                                color: "var(--muted)",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = "rgba(99,162,255,0.3)";
                                e.currentTarget.style.color = "var(--accent)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = "var(--border)";
                                e.currentTarget.style.color = "var(--muted)";
                              }}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-2.5">
                <div
                  className="w-7 h-7 rounded-full shrink-0 mt-1 flex items-center justify-center text-xs font-bold"
                  style={{
                    background: "var(--accent-dim)",
                    border: "1px solid rgba(99,162,255,0.35)",
                    color: "var(--accent)",
                    boxShadow: "0 0 8px rgba(99,162,255,0.3)",
                  }}
                >
                  AI
                </div>
                <div
                  className="rounded-2xl rounded-bl px-4 py-3"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                >
                  <div className="flex gap-1.5 items-center">
                    <div className="text-xs" style={{ color: "var(--muted)" }}>Searching documents and generating response</div>
                    <span className="dot-pulse"><span /><span /><span /></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input area */}
          <div className="mt-4 flex flex-col gap-1.5">
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question... (Enter to send)"
                disabled={loading}
                rows={1}
                className="input flex-1 resize-none"
                style={{ minHeight: "2.75rem", maxHeight: "8rem", lineHeight: "1.5" }}
                onInput={(e) => {
                  const t = e.target as HTMLTextAreaElement;
                  t.style.height = "auto";
                  t.style.height = Math.min(t.scrollHeight, 128) + "px";
                }}
              />
              <button
                onClick={() => sendMessage()}
                disabled={loading || !input.trim()}
                className="btn btn-primary shrink-0"
                style={{ height: "2.75rem", padding: "0 1.25rem" }}
              >
                Send
              </button>
            </div>
            {messages.length > 0 && (
              <button
                onClick={startNewConversation}
                className="text-xs self-start"
                style={{ color: "var(--muted-2)" }}
              >
                Start new conversation
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


// ── Citation Renderer ──────────────────────────────────────────────────────

function RenderedAnswer({ text, onCiteClick }: { text: string; onCiteClick: (n: number) => void }) {
  // Split text on citation patterns like [1], [2], [1][2], etc.
  const parts = text.split(/(\[\d+\])/g);

  return (
    <div className="whitespace-pre-wrap">
      {parts.map((part, i) => {
        const match = part.match(/^\[(\d+)\]$/);
        if (match) {
          const num = parseInt(match[1]);
          return (
            <button
              key={i}
              onClick={() => onCiteClick(num)}
              className="inline-flex items-center justify-center text-[10px] font-bold rounded-full mx-0.5 transition-all"
              style={{
                width: "18px",
                height: "18px",
                background: "var(--accent-dim)",
                color: "var(--accent)",
                border: "1px solid rgba(99,162,255,0.3)",
                verticalAlign: "super",
                cursor: "pointer",
              }}
              title={`View source ${num}`}
            >
              {num}
            </button>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </div>
  );
}


// ── Source Card ──────────────────────────────────────────────────────────────

function SourceCard({
  source,
  expanded,
  onToggle,
}: {
  source: SourceDetail;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className="rounded-lg overflow-hidden transition-all"
      style={{
        background: expanded ? "var(--surface)" : "transparent",
        border: `1px solid ${expanded ? "rgba(99,162,255,0.2)" : "var(--border)"}`,
      }}
    >
      <button
        onClick={onToggle}
        className="w-full text-left px-3 py-2 flex items-center gap-2"
      >
        <span
          className="flex items-center justify-center text-[10px] font-bold rounded-full shrink-0"
          style={{
            width: "20px",
            height: "20px",
            background: "var(--accent-dim)",
            color: "var(--accent)",
            border: "1px solid rgba(99,162,255,0.3)",
          }}
        >
          {source.index}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate" style={{ color: "var(--text)" }}>
            {source.title}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            {source.section && source.section !== source.title && (
              <span className="text-[10px] truncate" style={{ color: "var(--muted)" }}>
                {source.section}
              </span>
            )}
            {source.page_start && (
              <span className="text-[10px]" style={{ color: "var(--muted-2)" }}>
                pp. {source.page_start}{source.page_end && source.page_end !== source.page_start ? `–${source.page_end}` : ""}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] font-mono" style={{ color: "var(--accent)" }}>
            {Math.round(source.similarity * 100)}%
          </span>
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            style={{ color: "var(--muted-2)", transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 animate-in">
          <div
            className="rounded-md px-3 py-2.5 text-xs leading-relaxed font-mono"
            style={{
              background: "rgba(0,0,0,0.2)",
              border: "1px solid var(--border)",
              color: "var(--muted)",
              maxHeight: "200px",
              overflow: "auto",
              whiteSpace: "pre-wrap",
            }}
          >
            {source.text}
          </div>
        </div>
      )}
    </div>
  );
}
