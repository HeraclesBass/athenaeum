"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, type Library, type UploadResponse } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type FileStatus = "pending" | "uploading" | "done" | "error";

interface FileEntry {
  file: File;
  status: FileStatus;
  result?: UploadResponse;
  error?: string;
}

const ALLOWED_EXT = ["pdf", "txt", "md", "text"];
const MAX_FILE_SIZE = 50 * 1024 * 1024;

export default function UploadPage() {
  const params = useParams();
  const slug = params.slug as string;
  const auth = useAuth();

  const [library, setLibrary] = useState<Library | null>(null);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.libraryBySlug(slug).then(setLibrary).catch(() => {});
  }, [slug]);

  const isOwnerOrAdmin = auth.authenticated && library && (
    library.owner === auth.username || auth.is_admin
  );

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const entries: FileEntry[] = [];
    for (const f of Array.from(newFiles)) {
      const ext = f.name.split(".").pop()?.toLowerCase();
      if (!ALLOWED_EXT.includes(ext || "")) {
        entries.push({ file: f, status: "error", error: "Unsupported file type" });
      } else if (f.size > MAX_FILE_SIZE) {
        entries.push({ file: f, status: "error", error: "File too large (max 50MB)" });
      } else {
        entries.push({ file: f, status: "pending" });
      }
    }
    setFiles((prev) => [...prev, ...entries]);
  }, []);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function clearCompleted() {
    setFiles((prev) => prev.filter((f) => f.status !== "done" && f.status !== "error"));
  }

  async function uploadAll() {
    if (!library) return;
    setUploading(true);

    for (let i = 0; i < files.length; i++) {
      if (files[i].status !== "pending") continue;

      // Mark as uploading
      setFiles((prev) => prev.map((f, j) =>
        j === i ? { ...f, status: "uploading" as FileStatus } : f
      ));

      try {
        const result = await api.upload(library.id, files[i].file);
        setFiles((prev) => prev.map((f, j) =>
          j === i ? { ...f, status: "done" as FileStatus, result } : f
        ));
      } catch (e) {
        const error = e instanceof Error ? e.message : "Upload failed";
        setFiles((prev) => prev.map((f, j) =>
          j === i ? { ...f, status: "error" as FileStatus, error } : f
        ));
      }
    }

    setUploading(false);
  }

  const pendingCount = files.filter((f) => f.status === "pending").length;
  const doneCount = files.filter((f) => f.status === "done").length;
  const errorCount = files.filter((f) => f.status === "error").length;
  const totalSections = files.reduce((s, f) => s + (f.result?.sections_created ?? 0), 0);
  const totalChunks = files.reduce((s, f) => s + (f.result?.chunks_created ?? 0), 0);
  const totalEmbedded = files.reduce((s, f) => s + (f.result?.chunks_embedded ?? 0), 0);

  // Auth gate
  if (!auth.authenticated) {
    return (
      <div className="text-center py-16">
        <svg className="mx-auto mb-4" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--muted)" }}>
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <p className="text-lg mb-2" style={{ color: "var(--muted)" }}>Sign in required</p>
        <p className="text-sm mb-4" style={{ color: "var(--muted-2)" }}>You need to sign in to upload documents.</p>
        <a href={process.env.NEXT_PUBLIC_AUTH_URL || "/api/auth"} className="btn btn-primary">Sign in</a>
      </div>
    );
  }

  if (library && !isOwnerOrAdmin) {
    return (
      <div className="text-center py-16">
        <p className="text-lg mb-2" style={{ color: "var(--muted)" }}>Not authorized</p>
        <p className="text-sm mb-4" style={{ color: "var(--muted-2)" }}>Only the library owner or admins can upload documents.</p>
        <Link href={`/library/${slug}`} className="btn btn-ghost">Back to library</Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold">
          Upload — {library?.name || "Loading..."}
        </h1>
        <p className="text-xs sm:text-sm mt-1" style={{ color: "var(--muted)" }}>
          Upload one or more PDF, TXT, or MD files. They will be extracted, chunked, and embedded automatically.
        </p>
      </div>

      <div
        className="max-w-2xl mx-auto"
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {/* Drop zone */}
        <div
          className="rounded-xl border-2 border-dashed p-8 sm:p-12 text-center cursor-pointer transition-all"
          style={{
            borderColor: dragOver ? "var(--accent)" : "var(--border)",
            background: dragOver ? "var(--accent-dim)" : "transparent",
          }}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInputRef.current?.click(); } }}
          role="button"
          tabIndex={0}
          aria-label="Upload area. Click or press Enter to browse files, or drag and drop files here."
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.md,.text"
            multiple
            className="sr-only"
            aria-label="Select files to upload"
            onChange={(e) => e.target.files?.length && addFiles(e.target.files)}
          />
          <svg aria-hidden="true" className="mx-auto mb-4" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--muted)" }}>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <p className="text-sm font-medium mb-1">
            Drop files here or click to browse
          </p>
          <p className="text-xs" style={{ color: "var(--muted-2)" }}>
            PDF, TXT, MD — up to 50MB per file — multiple files supported
          </p>
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="mt-4 space-y-2 animate-in">
            {files.map((entry, i) => (
              <div key={`${entry.file.name}-${i}`} className="card p-3 flex items-center gap-3">
                {/* Status icon */}
                <div className="shrink-0">
                  {entry.status === "pending" && (
                    <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "var(--surface-2)" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--muted-2)" }}>
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                    </div>
                  )}
                  {entry.status === "uploading" && (
                    <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "var(--accent-dim)" }}>
                      <span className="dot-pulse"><span /><span /><span /></span>
                    </div>
                  )}
                  {entry.status === "done" && (
                    <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "var(--green-dim)" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--green)" }}>
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  )}
                  {entry.status === "error" && (
                    <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "var(--red-dim)" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" style={{ color: "var(--red)" }}>
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* File info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{entry.file.name}</p>
                  <p className="text-[11px]" style={{ color: "var(--muted-2)" }}>
                    {entry.status === "uploading" ? "Processing..." :
                     entry.status === "done" && entry.result ? (
                       `${entry.result.sections_created} sections, ${entry.result.chunks_created} chunks, ${entry.result.chunks_embedded} embedded`
                     ) :
                     entry.status === "error" ? entry.error :
                     `${(entry.file.size / 1024).toFixed(1)} KB`}
                  </p>
                </div>

                {/* Remove button (only when not uploading) */}
                {!uploading && (
                  <button
                    onClick={() => removeFile(i)}
                    className="btn-icon shrink-0"
                    style={{ width: "1.5rem", height: "1.5rem" }}
                    title="Remove"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
            ))}

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-2">
              {pendingCount > 0 && (
                <button
                  onClick={uploadAll}
                  disabled={uploading}
                  className="btn btn-primary"
                >
                  {uploading ? (
                    <>
                      <span className="dot-pulse"><span /><span /><span /></span>
                      Processing...
                    </>
                  ) : (
                    `Upload ${pendingCount} ${pendingCount === 1 ? "file" : "files"}`
                  )}
                </button>
              )}
              {(doneCount > 0 || errorCount > 0) && !uploading && (
                <button onClick={clearCompleted} className="btn btn-ghost text-xs">
                  Clear completed
                </button>
              )}
            </div>
          </div>
        )}

        {/* Summary after all done */}
        {files.length > 0 && doneCount > 0 && !uploading && pendingCount === 0 && (
          <div className="mt-4 animate-in">
            <div
              className="rounded-xl p-5 border"
              style={{
                background: "rgba(34,197,94,0.05)",
                borderColor: "rgba(34,197,94,0.2)",
              }}
            >
              <p className="text-sm font-semibold mb-3" style={{ color: "#22c55e" }}>
                {doneCount} {doneCount === 1 ? "file" : "files"} uploaded
                {errorCount > 0 && (
                  <span style={{ color: "var(--red)" }}> ({errorCount} failed)</span>
                )}
              </p>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-2xl font-bold">{totalSections}</p>
                  <p className="text-xs" style={{ color: "var(--muted)" }}>sections</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalChunks}</p>
                  <p className="text-xs" style={{ color: "var(--muted)" }}>chunks</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalEmbedded}</p>
                  <p className="text-xs" style={{ color: "var(--muted)" }}>embedded</p>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Link href={`/library/${slug}`} className="btn btn-primary text-xs">View Library</Link>
                <Link href={`/library/${slug}/chat`} className="btn btn-ghost text-xs">Start Chatting</Link>
                <button onClick={() => setFiles([])} className="btn btn-ghost text-xs">Upload More</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
