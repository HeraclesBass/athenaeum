"use client";

import { useEffect, useState } from "react";
import { api, type TopicDetail as TopicDetailData } from "@/lib/api";
import TranscriptViewer from "./TranscriptViewer";

interface Props {
  topicId: number;
  onClose: () => void;
}

export default function TopicDetail({ topicId, onClose }: Props) {
  const [topic, setTopic] = useState<TopicDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTranscript, setSelectedTranscript] = useState<number | null>(null);

  useEffect(() => {
    api
      .topic(topicId)
      .then(setTopic)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [topicId]);

  if (loading) {
    return <p style={{ color: "var(--muted)" }}>Loading topic…</p>;
  }

  if (!topic) {
    return <p style={{ color: "var(--muted)" }}>Topic not found.</p>;
  }

  return (
    <div>
      <button
        onClick={onClose}
        className="text-sm mb-4 hover:underline"
        style={{ color: "var(--muted)" }}
      >
        ← All topics
      </button>

      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">{topic.name}</h2>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          {topic.chunk_count} chunks · {topic.transcript_count} transcripts
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          {topic.keywords.map((kw) => (
            <span
              key={kw}
              className="text-sm px-3 py-1 rounded-full"
              style={{
                background: "rgba(99,162,255,0.1)",
                color: "var(--accent)",
                border: "1px solid rgba(99,162,255,0.25)",
              }}
            >
              {kw}
            </span>
          ))}
        </div>
      </div>

      <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--muted)" }}>
        Related transcripts ({topic.transcripts.length})
      </h3>
      <ul className="space-y-2">
        {topic.transcripts.map((t) => (
          <li key={t.id}>
            <button
              onClick={() => setSelectedTranscript(t.id)}
              className="w-full text-left rounded-lg px-4 py-3 border hover:border-amber-600 transition-colors"
              style={{ background: "var(--surface)", borderColor: "var(--border)" }}
            >
              <p className="text-sm font-medium">{t.title}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                {t.series && `${t.series} · `}
                {t.word_count.toLocaleString()} words
              </p>
            </button>
          </li>
        ))}
      </ul>

      {selectedTranscript !== null && (
        <TranscriptViewer
          transcriptId={selectedTranscript}
          onClose={() => setSelectedTranscript(null)}
        />
      )}
    </div>
  );
}
