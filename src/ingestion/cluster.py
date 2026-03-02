"""Auto-discover topics from chunk embeddings using K-Means + keyword extraction.

Multi-library aware: clusters per library_id, stores in topics + document_topics tables.
"""

import json
import logging
import re
from collections import Counter

import numpy as np
import psycopg2
import psycopg2.extras
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score

from config.settings import DATABASE_URL

logger = logging.getLogger("athenaeum.cluster")

MIN_CHUNKS_FOR_CLUSTERING = 10
MAX_CLUSTERS = 20

STOPWORDS = {
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "can", "need", "to", "of", "in",
    "for", "on", "with", "at", "by", "from", "as", "into", "through",
    "during", "before", "after", "between", "out", "off", "over", "under",
    "again", "then", "once", "here", "there", "when", "where", "why",
    "how", "all", "both", "each", "few", "more", "most", "other", "some",
    "such", "no", "nor", "not", "only", "own", "same", "so", "than",
    "too", "very", "just", "now", "and", "but", "or", "if", "while",
    "because", "about", "that", "this", "these", "those", "what", "which",
    "who", "whom", "it", "its", "he", "she", "they", "them", "his", "her",
    "their", "we", "us", "our", "you", "your", "me", "my", "myself",
    "going", "get", "got", "thing", "things", "say", "said", "know",
    "like", "really", "see", "well", "one", "way", "something", "don",
    "mean", "people", "right", "come", "think", "make", "take", "much",
    "want", "look", "give", "back", "also", "even", "new", "first",
    "let", "put", "go", "call", "called", "always", "every", "still",
    "whole", "anything", "nothing", "everything",
}


def load_library_embeddings(conn, library_id: int):
    """Load chunk embeddings for a specific library."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT c.id, c.embedding::text, c.text, c.document_id
            FROM chunks c
            WHERE c.embedding IS NOT NULL AND c.library_id = %s
            ORDER BY c.id
        """, (library_id,))
        rows = cur.fetchall()

    chunk_ids = []
    embeddings = []
    texts = []
    doc_ids = []

    for row in rows:
        chunk_ids.append(row[0])
        vec_str = row[1].strip("[]")
        vec = [float(x) for x in vec_str.split(",")]
        embeddings.append(vec)
        texts.append(row[2])
        doc_ids.append(row[3])

    return chunk_ids, np.array(embeddings) if embeddings else np.array([]), texts, doc_ids


def find_optimal_k(embeddings: np.ndarray) -> int:
    """Find optimal cluster count using silhouette score."""
    n = len(embeddings)
    if n < 10:
        return min(3, n - 1)

    max_k = min(MAX_CLUSTERS, n // 3)
    min_k = max(3, max_k // 3)
    k_range = range(min_k, max_k + 1)

    best_k = min_k
    best_score = -1

    sample_size = min(2000, n)
    for k in k_range:
        km = KMeans(n_clusters=k, random_state=42, n_init=10, max_iter=300)
        labels = km.fit_predict(embeddings)
        score = silhouette_score(embeddings, labels, sample_size=sample_size, random_state=42)
        if score > best_score:
            best_score = score
            best_k = k

    logger.info("optimal_k", extra={"extra": {"best_k": best_k, "silhouette": round(best_score, 4)}})
    return best_k


def extract_keywords(texts: list[str], top_n: int = 15) -> list[str]:
    """Extract distinguishing keywords from cluster texts."""
    words = Counter()
    bigrams = Counter()

    for text in texts:
        text_words = re.findall(r'\b[a-z]{3,}\b', text.lower())
        filtered = [w for w in text_words if w not in STOPWORDS]
        words.update(filtered)
        for i in range(len(filtered) - 1):
            bigrams[f"{filtered[i]} {filtered[i+1]}"] += 1

    top_bigrams = [b for b, c in bigrams.most_common(10) if c >= 3]
    top_words = [w for w, _ in words.most_common(top_n)]
    return top_bigrams[:5] + top_words[:top_n - 5]


def label_from_keywords(keywords: list[str]) -> str:
    """Generate a topic label from top keywords."""
    clean = [k for k in keywords[:6] if len(k) > 3]
    if not clean:
        return "General"
    return " & ".join(w.title() for w in clean[:3])


def cluster_library(library_id: int) -> int:
    """Run topic clustering for a library. Returns number of topics created."""
    conn = psycopg2.connect(DATABASE_URL)
    try:
        chunk_ids, embeddings, texts, doc_ids = load_library_embeddings(conn, library_id)

        if len(chunk_ids) < MIN_CHUNKS_FOR_CLUSTERING:
            logger.info("skip_clustering", extra={"extra": {
                "library_id": library_id, "chunks": len(chunk_ids),
                "reason": f"need >= {MIN_CHUNKS_FOR_CLUSTERING} chunks",
            }})
            return 0

        n_clusters = find_optimal_k(embeddings)
        km = KMeans(n_clusters=n_clusters, random_state=42, n_init=10, max_iter=300)
        labels = km.fit_predict(embeddings)

        # Clear existing topics for this library
        with conn.cursor() as cur:
            cur.execute("DELETE FROM topics WHERE library_id = %s", (library_id,))

        # Build cluster data
        topics_created = 0
        for cluster_id in range(n_clusters):
            mask = labels == cluster_id
            cluster_texts = [texts[i] for i in range(len(texts)) if mask[i]]
            cluster_doc_ids = [doc_ids[i] for i in range(len(doc_ids)) if mask[i]]

            keywords = extract_keywords(cluster_texts)
            topic_name = label_from_keywords(keywords)

            # Deduplicate topic names
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT COUNT(*) FROM topics WHERE library_id = %s AND name = %s",
                    (library_id, topic_name)
                )
                if cur.fetchone()[0] > 0:
                    topic_name = f"{topic_name} ({cluster_id})"

                # Insert topic
                cur.execute("""
                    INSERT INTO topics (library_id, name, description)
                    VALUES (%s, %s, %s) RETURNING id
                """, (library_id, topic_name, json.dumps({"keywords": keywords[:10], "chunk_count": int(sum(mask))})))
                topic_id = cur.fetchone()[0]
                topics_created += 1

                # Document-topic relevance scores
                doc_counts = Counter(cluster_doc_ids)
                unique_docs = set(cluster_doc_ids)
                for did in unique_docs:
                    cur.execute(
                        "SELECT COUNT(*) FROM chunks WHERE document_id = %s AND embedding IS NOT NULL",
                        (did,)
                    )
                    total = cur.fetchone()[0]
                    score = round(doc_counts[did] / max(total, 1), 3)
                    cur.execute("""
                        INSERT INTO document_topics (document_id, topic_id, relevance_score)
                        VALUES (%s, %s, %s) ON CONFLICT DO NOTHING
                    """, (did, topic_id, score))

        conn.commit()
        logger.info("clustering_complete", extra={"extra": {
            "library_id": library_id, "topics": topics_created,
            "chunks": len(chunk_ids), "clusters": n_clusters,
        }})
        return topics_created

    finally:
        conn.close()
