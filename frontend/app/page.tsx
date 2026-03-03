"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { api, type Library } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function HomePage() {
  const auth = useAuth();
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newVisibility, setNewVisibility] = useState<"public" | "private">("private");

  useEffect(() => {
    api.libraries()
      .then(setLibraries)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function autoSlug(name: string) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !newSlug.trim()) return;
    setCreating(true);
    try {
      const lib = await api.createLibrary({
        name: newName.trim(),
        slug: newSlug.trim(),
        description: newDesc.trim(),
        visibility: newVisibility,
      });
      setLibraries((prev) => [lib, ...prev]);
      setShowCreate(false);
      setNewName(""); setNewSlug(""); setNewDesc("");
      setNewVisibility("private");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  const publicLibs = libraries.filter((l) => l.visibility === "public");
  const privateLibs = libraries.filter((l) => l.visibility === "private");
  const totalDocs = libraries.reduce((s, l) => s + l.document_count, 0);
  const totalChunks = libraries.reduce((s, l) => s + l.chunk_count, 0);

  return (
    <div>
      {/* ── Hero Section ─────────────────────────────────────────── */}
      <section className="text-center pt-8 sm:pt-12 pb-10 sm:pb-14 relative">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 800px 400px at 50% 20%, rgba(91,154,255,0.08) 0%, transparent 70%)",
          }}
        />
        <div className="relative">
          <h1
            className="text-5xl font-bold mb-4 gradient-text"
            style={{ letterSpacing: "-0.04em" }}
          >
            Athenaeum
          </h1>
          <p
            className="text-lg mb-2 max-w-xl mx-auto"
            style={{ color: "var(--text-secondary)" }}
          >
            Your documents, searchable and conversational.
          </p>
          <p
            className="text-sm mb-8 max-w-lg mx-auto leading-relaxed"
            style={{ color: "var(--muted)" }}
          >
            Upload PDFs, text, or markdown into organized libraries.
            Search semantically across your content and chat with AI
            that cites its sources directly from your documents.
          </p>

          {/* Stats */}
          {!loading && libraries.length > 0 && (
            <div className="flex items-center justify-center gap-6 mb-8">
              <Stat value={libraries.length} label={libraries.length === 1 ? "Library" : "Libraries"} />
              <div className="w-px h-8" style={{ background: "var(--border)" }} />
              <Stat value={totalDocs} label="Documents" />
              <div className="w-px h-8" style={{ background: "var(--border)" }} />
              <Stat value={totalChunks} label="Indexed Chunks" />
            </div>
          )}

          {/* CTA */}
          {auth.authenticated ? (
            <button onClick={() => setShowCreate(!showCreate)} className="btn-glow">
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Create Library
            </button>
          ) : (
            <a href="https://auth.herakles.dev" className="btn-glow">
              Sign in to create your own library
            </a>
          )}
        </div>
      </section>

      {/* ── Feature Highlights ───────────────────────────────────── */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mb-10 sm:mb-14">
        <FeatureCard
          icon={<path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />}
          title="Semantic Search"
          desc="Find content by meaning, not just keywords"
        />
        <FeatureCard
          icon={<><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></>}
          title="AI Chat"
          desc="Ask questions, get cited answers from your docs"
        />
        <FeatureCard
          icon={<><path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" /></>}
          title="Cross-Library"
          desc="Search and chat across multiple libraries at once"
        />
        <FeatureCard
          icon={<><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></>}
          title="Private & Local"
          desc="Local embeddings, no data leaves your server"
        />
      </section>

      {/* ── Create form ──────────────────────────────────────────── */}
      {showCreate && (
        <div className="max-w-md mx-auto mb-12 animate-in">
          <form onSubmit={handleCreate} className="card p-5 space-y-3.5">
            <div>
              <label htmlFor="lib-name" className="section-label block mb-1.5">Name</label>
              <input
                id="lib-name"
                type="text"
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  if (!newSlug || newSlug === autoSlug(newName)) setNewSlug(autoSlug(e.target.value));
                }}
                placeholder="My Research Library"
                className="input"
                required
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="lib-slug" className="section-label block mb-1.5">Slug</label>
              <input
                id="lib-slug"
                type="text"
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                placeholder="my-research-library"
                className="input"
                required
              />
              <p className="text-[11px] mt-1" style={{ color: "var(--muted-2)" }}>
                URL-safe identifier (lowercase, numbers, hyphens)
              </p>
            </div>
            <div>
              <label htmlFor="lib-desc" className="section-label block mb-1.5">Description</label>
              <textarea
                id="lib-desc"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="What's in this library?"
                className="input"
                rows={2}
              />
            </div>
            <div>
              <span id="visibility-label" className="section-label block mb-1.5">Visibility</span>
              <div className="flex gap-2" role="group" aria-labelledby="visibility-label">
                {(["private", "public"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setNewVisibility(v)}
                    aria-pressed={newVisibility === v}
                    className="btn text-xs flex-1"
                    style={{
                      background: newVisibility === v ? "var(--accent-dim)" : "transparent",
                      color: newVisibility === v ? "var(--accent)" : "var(--muted-2)",
                      border: `1px solid ${newVisibility === v ? "rgba(91,154,255,0.3)" : "var(--border)"}`,
                    }}
                  >
                    {v.charAt(0).toUpperCase() + v.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={creating} className="btn btn-primary flex-1">
                {creating ? "Creating..." : "Create Library"}
              </button>
              <button type="button" onClick={() => setShowCreate(false)} className="btn btn-ghost">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {error && (
        <p role="alert" className="text-center text-xs mb-4" style={{ color: "var(--red)" }}>{error}</p>
      )}

      {/* ── Loading ──────────────────────────────────────────────── */}
      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-5">
              <div className="skeleton h-5 w-2/3 mb-3" />
              <div className="skeleton h-3 w-full mb-2" />
              <div className="skeleton h-3 w-1/2 mb-4" />
              <div className="flex gap-2">
                <div className="skeleton h-5 w-14 rounded-full" />
                <div className="skeleton h-5 w-16 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Public Libraries ─────────────────────────────────────── */}
      {publicLibs.length > 0 && (
        <section className="mb-10">
          <div className="divider-label">
            <span className="section-label">Public Libraries</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {publicLibs.map((lib) => (
              <LibraryCard key={lib.id} lib={lib} />
            ))}
          </div>
        </section>
      )}

      {/* ── Your Libraries ───────────────────────────────────────── */}
      {auth.authenticated && privateLibs.length > 0 && (
        <section className="mb-10">
          <div className="divider-label">
            <span className="section-label">Your Libraries</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {privateLibs.map((lib) => (
              <LibraryCard key={lib.id} lib={lib} showLock />
            ))}
          </div>
        </section>
      )}

      {/* ── Empty state ──────────────────────────────────────────── */}
      {!loading && libraries.length === 0 && !error && (
        <div className="text-center py-16">
          <svg
            aria-hidden="true"
            className="mx-auto mb-5"
            width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ color: "var(--muted-2)" }}
          >
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
          <p className="text-base mb-1" style={{ color: "var(--muted)" }}>No libraries yet</p>
          <p className="text-sm" style={{ color: "var(--muted-2)" }}>
            {auth.authenticated ? "Create your first library to get started." : "Sign in to create your own library."}
          </p>
        </div>
      )}

      {/* ── Anonymous nudge ──────────────────────────────────────── */}
      {!auth.authenticated && !loading && publicLibs.length > 0 && (
        <div className="text-center py-8">
          <p className="text-xs" style={{ color: "var(--muted-2)" }}>
            <a href="https://auth.herakles.dev" style={{ color: "var(--accent)" }}>Sign in</a>
            {" "}to create your own library and upload documents
          </p>
        </div>
      )}
    </div>
  );
}


// ── Stat Component ──────────────────────────────────────────────────────────

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <p className="text-2xl font-bold" style={{ color: "var(--text)" }}>
        {value.toLocaleString()}
      </p>
      <p className="text-xs" style={{ color: "var(--muted)" }}>{label}</p>
    </div>
  );
}


// ── Feature Card ────────────────────────────────────────────────────────────

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div
      className="rounded-xl p-4 text-center"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <svg
        aria-hidden="true"
        className="mx-auto mb-2.5"
        width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
        style={{ color: "var(--accent)" }}
      >
        {icon}
      </svg>
      <p className="text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>{title}</p>
      <p className="text-[11px] leading-relaxed" style={{ color: "var(--muted)" }}>{desc}</p>
    </div>
  );
}


// ── Library Card ────────────────────────────────────────────────────────────

function LibraryCard({ lib, showLock }: { lib: Library; showLock?: boolean }) {
  return (
    <Link href={`/library/${lib.slug}`} className="card-hover p-5 block group">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <h2 className="font-semibold text-sm leading-tight">{lib.name}</h2>
        {showLock && lib.visibility === "private" && (
          <svg
            width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ color: "var(--muted-2)", flexShrink: 0, marginTop: 2 }}
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        )}
      </div>
      {lib.description && (
        <p className="text-xs mb-3 line-clamp-2 leading-relaxed" style={{ color: "var(--muted)" }}>
          {lib.description}
        </p>
      )}
      <div className="flex items-center gap-3 mt-auto">
        <span className="badge text-[10px]">
          {lib.document_count} {lib.document_count === 1 ? "doc" : "docs"}
        </span>
        <span className="badge badge-muted text-[10px]">
          {lib.chunk_count} chunks
        </span>
      </div>
    </Link>
  );
}
