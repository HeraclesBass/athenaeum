import type { Metadata } from "next";

// Server-side: use internal Docker service name; client-side: use relative path
const API_URL = process.env.NEXT_PUBLIC_API_URL || process.env.INTERNAL_API_URL || "http://api:8000";

interface Props {
  params: { slug: string };
  children: React.ReactNode;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    // Server-side fetch for metadata (uses internal URL or relative)
    const url = API_URL
      ? `${API_URL}/api/libraries/by-slug/${params.slug}`
      : `http://127.0.0.1:8140/api/libraries/by-slug/${params.slug}`;
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) throw new Error("Not found");
    const lib = await res.json();

    const title = `${lib.name} — Athenaeum`;
    const description = lib.description
      || `${lib.document_count} documents, ${lib.chunk_count} indexed chunks`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        siteName: "Athenaeum",
        type: "website",
        url: `https://athenaeum.herakles.dev/library/${params.slug}`,
      },
      twitter: {
        card: "summary",
        title,
        description,
      },
    };
  } catch {
    return {
      title: "Library — Athenaeum",
    };
  }
}

export default function LibraryLayout({ children }: Props) {
  return <>{children}</>;
}
