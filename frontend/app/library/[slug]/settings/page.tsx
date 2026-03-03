"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, type Library } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function SettingsPage() {
  const params = useParams();
  const slug = params.slug as string;
  const router = useRouter();
  const auth = useAuth();

  const [library, setLibrary] = useState<Library | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("private");

  const [showDelete, setShowDelete] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api.libraryBySlug(slug)
      .then((lib) => {
        setLibrary(lib);
        setName(lib.name);
        setDescription(lib.description || "");
        setVisibility(lib.visibility);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  const isOwnerOrAdmin = auth.authenticated && library && (
    library.owner === auth.username || auth.is_admin
  );

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!library) return;
    setSaving(true); setSaved(false); setError(null);
    try {
      const updated = await api.updateLibrary(library.id, { name: name.trim(), description: description.trim(), visibility });
      setLibrary(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!library || deleteConfirm !== library.slug) return;
    setDeleting(true);
    try {
      await api.deleteLibrary(library.id);
      router.push("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-lg">
        <div className="skeleton h-7 w-48 mb-6" />
        <div className="skeleton h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!auth.authenticated) {
    return (
      <div className="text-center py-20">
        <p className="text-sm mb-3" style={{ color: "var(--muted)" }}>Sign in to access settings</p>
        <a href={process.env.NEXT_PUBLIC_AUTH_URL || "/api/auth"} className="btn btn-primary text-xs">Sign in</a>
      </div>
    );
  }

  if (!isOwnerOrAdmin) {
    return (
      <div className="text-center py-20">
        <p className="text-sm mb-1" style={{ color: "var(--muted)" }}>Not authorized</p>
        <p className="text-xs mb-4" style={{ color: "var(--muted-2)" }}>Only the library owner or admins can access settings.</p>
        <Link href={`/library/${slug}`} className="btn btn-ghost text-xs">Back to library</Link>
      </div>
    );
  }

  if (!library) return null;

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={`/library/${slug}`}
          className="btn-icon"
          style={{ width: "1.75rem", height: "1.75rem" }}
          title="Back to library"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <h1 className="text-xl font-bold tracking-tight">Library Settings</h1>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg p-3 mb-5 text-xs"
          style={{ background: "var(--red-dim)", color: "var(--red)", border: "1px solid rgba(248,113,113,0.15)" }}
        >
          {error}
        </div>
      )}

      {/* Edit form */}
      <form onSubmit={handleSave} className="card p-5 space-y-4 mb-6">
        <div>
          <label htmlFor="settings-name" className="section-label block mb-1.5">Name</label>
          <input id="settings-name" type="text" value={name} onChange={(e) => setName(e.target.value)} className="input" required />
        </div>
        <div>
          <label htmlFor="settings-desc" className="section-label block mb-1.5">Description</label>
          <textarea id="settings-desc" value={description} onChange={(e) => setDescription(e.target.value)} className="input" rows={3} />
        </div>
        <div>
          <span id="settings-visibility" className="section-label block mb-1.5">Visibility</span>
          <div className="flex gap-2" role="group" aria-labelledby="settings-visibility">
            {(["private", "public"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVisibility(v)}
                aria-pressed={visibility === v}
                className="btn text-xs flex-1"
                style={{
                  background: visibility === v ? "var(--accent-dim)" : "transparent",
                  color: visibility === v ? "var(--accent)" : "var(--muted-2)",
                  border: `1px solid ${visibility === v ? "rgba(91,154,255,0.3)" : "var(--border)"}`,
                }}
              >
                {v === "private" ? (
                  <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                ) : (
                  <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
                )}
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          <p className="text-[11px] mt-1.5" style={{ color: "var(--muted-2)" }}>
            {visibility === "public"
              ? "Anyone can search and chat with this library without signing in."
              : "Only you and admins can access this library."}
          </p>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? "Saving..." : "Save Changes"}
          </button>
          {saved && (
            <span className="text-xs flex items-center gap-1" style={{ color: "var(--green)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              Saved
            </span>
          )}
        </div>
      </form>

      {/* Danger zone */}
      <div
        className="rounded-xl border p-5"
        style={{ borderColor: "rgba(248,113,113,0.15)", background: "var(--red-dim)" }}
      >
        <h2 className="text-xs font-semibold mb-1.5" style={{ color: "var(--red)" }}>Danger Zone</h2>
        <p className="text-[11px] mb-3.5 leading-relaxed" style={{ color: "var(--muted)" }}>
          Deleting a library permanently removes all documents, chunks, and embeddings. This cannot be undone.
        </p>
        {!showDelete ? (
          <button onClick={() => setShowDelete(true)} className="btn btn-danger text-xs">
            Delete Library
          </button>
        ) : (
          <div className="animate-in space-y-2.5">
            <p className="text-[11px]" style={{ color: "var(--muted)" }}>
              Type <strong style={{ color: "var(--text)" }}>{library.slug}</strong> to confirm:
            </p>
            <input
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder={library.slug}
              className="input"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={deleteConfirm !== library.slug || deleting}
                className="btn btn-danger text-xs"
              >
                {deleting ? "Deleting..." : "Permanently Delete"}
              </button>
              <button
                onClick={() => { setShowDelete(false); setDeleteConfirm(""); }}
                className="btn btn-ghost text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
