"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, type Library, type SearchResult, type DocumentSummary } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useKeyboard } from "@/lib/useKeyboard";

export default function LibraryDashboard() {
  const params = useParams();
  const slug = params.slug as string;
  const auth = useAuth();

  const [library, setLibrary] = useState<Library | null>(null);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const keyHandlers = useMemo(() => ({
    "/": () => searchInputRef.current?.focus(),
    "Escape": () => { if (searched) { setSearched(false); setSearchResults([]); setQuery(""); } },
  }), [searched]);
  useKeyboard(keyHandlers);

  const isOwnerOrAdmin = auth.authenticated && library && (
    library.owner === auth.username || auth.is_admin
  );

  useEffect(() => {
    api.libraryBySlug(slug)
      .then((lib) => {
        setLibrary(lib);
        return api.documents(lib.id, { limit: 50 });
      })
      .then(setDocuments)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!library || !query.trim()) return;
    setSearched(true);
    setSearchLoading(true);
    try {
      const data = await api.search(library.id, query.trim(), 20);
      setSearchResults(data.results);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setSearchLoading(false);
    }
  }

  if (loading) {
    return (
      <div>
        <div className="skeleton h-7 w-56 mb-3" />
        <div className="skeleton h-3.5 w-80 mb-6" />
        <div className="flex gap-2 mb-8">
          <div className="skeleton h-5 w-20 rounded-full" />
          <div className="skeleton h-5 w-16 rounded-full" />
        </div>
        <div className="skeleton h-10 w-full max-w-xl mb-8" />
        <div className="grid gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-14 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error && !library) {
    return (
      <div className="text-center py-20">
        <p className="text-sm mb-3" style={{ color: "var(--red)" }}>{error}</p>
        <Link href="/" className="btn btn-ghost">Back to libraries</Link>
      </div>
    );
  }

  if (!library) return null;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center gap-3 mb-1.5">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{library.name}</h1>
          {library.visibility === "private" && (
            <span className="badge badge-muted text-[10px] gap-1">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Private
            </span>
          )}
        </div>
        {library.description && (
          <p className="text-sm mb-4 max-w-xl" style={{ color: "var(--muted)" }}>
            {library.description}
          </p>
        )}

        {/* Stats + actions row */}
        <div className="flex items-center gap-5 flex-wrap">
          <div className="flex gap-2">
            <span className="badge">{library.document_count} documents</span>
            <span className="badge">{library.chunk_count} chunks</span>
          </div>
          <div className="flex gap-2">
            <Link href={`/library/${slug}/chat`} className="btn-glow" style={{ fontSize: "0.75rem", padding: "0.35rem 1rem" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              Chat with AI
            </Link>
            {isOwnerOrAdmin && (
              <>
                <Link href={`/library/${slug}/upload`} className="btn btn-ghost" style={{ fontSize: "0.75rem", padding: "0.35rem 0.75rem" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  Upload
                </Link>
                <Link
                  href={`/library/${slug}/settings`}
                  className="btn-icon"
                  title="Settings"
                  style={{ width: "1.75rem", height: "1.75rem" }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                  </svg>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="max-w-xl mb-8">
        <form onSubmit={handleSearch} className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ color: "var(--muted-2)" }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${library.name}... (press /)`}
            className="input"
            style={{ paddingLeft: "2.25rem", paddingRight: searched ? "4rem" : undefined }}
          />
          {searched && (
            <button
              type="button"
              onClick={() => { setSearched(false); setSearchResults([]); setQuery(""); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] transition-colors"
              style={{ color: "var(--muted-2)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--muted-2)")}
            >
              Clear
            </button>
          )}
        </form>
      </div>

      {error && <p className="text-xs mb-4" style={{ color: "var(--red)" }}>{error}</p>}

      {/* Search results */}
      {searched && (
        <div className="mb-10 animate-in">
          <p className="text-[11px] mb-3" style={{ color: "var(--muted)" }}>
            {searchResults.length} {searchResults.length === 1 ? "result" : "results"} for &ldquo;{query}&rdquo;
          </p>
          {searchResults.length === 0 && !searchLoading && (
            <p className="text-sm" style={{ color: "var(--muted)" }}>No results found.</p>
          )}
          <div className="grid gap-2.5">
            {searchResults.map((r) => (
              <div key={r.chunk_id} className="card p-4 flex items-start gap-3.5">
                <div
                  className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-xs font-mono font-semibold"
                  style={{
                    background: r.similarity >= 0.65 ? "var(--accent-dim)" : "rgba(255,255,255,0.03)",
                    color: r.similarity >= 0.65 ? "var(--accent)" : "var(--muted)",
                    border: `1px solid ${r.similarity >= 0.65 ? "rgba(91,154,255,0.15)" : "var(--border)"}`,
                  }}
                >
                  {Math.round(r.similarity * 100)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium mb-0.5 leading-snug">{r.document_title}</p>
                  {r.section && r.section !== r.document_title && (
                    <p className="text-[11px] mb-1" style={{ color: "var(--muted-2)" }}>{r.section}</p>
                  )}
                  <p className="text-xs leading-relaxed line-clamp-2" style={{ color: "var(--muted)" }}>
                    {r.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Documents list */}
      {!searched && (
        <div>
          <div className="divider-label">
            <span className="section-label">Documents ({documents.length})</span>
          </div>
          {documents.length === 0 ? (
            <div className="card p-10 text-center">
              <svg
                className="mx-auto mb-3"
                width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ color: "var(--muted-2)" }}
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              <p className="text-sm mb-3" style={{ color: "var(--muted)" }}>No documents yet</p>
              {isOwnerOrAdmin && (
                <Link href={`/library/${slug}/upload`} className="btn btn-primary text-xs">
                  Upload your first document
                </Link>
              )}
            </div>
          ) : (
            <div className="grid gap-1.5">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between py-2.5 px-3.5 rounded-lg transition-colors"
                  style={{ background: "transparent" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <svg
                      width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      style={{ color: "var(--muted-2)", flexShrink: 0 }}
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                    <div className="min-w-0">
                      <p className="text-sm truncate">{doc.title}</p>
                      {doc.section && doc.section !== doc.title && (
                        <p className="text-[11px] truncate" style={{ color: "var(--muted-2)" }}>
                          {doc.section}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="text-[11px] shrink-0 ml-3" style={{ color: "var(--muted-2)" }}>
                    {doc.word_count.toLocaleString()}w
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
