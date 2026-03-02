import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import { AuthProvider } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Athenaeum — Semantic Library Platform",
  description: "Upload documents, search semantically, and chat with AI that cites its sources. Organize content into libraries with per-library AI personas.",
  openGraph: {
    title: "Athenaeum — Semantic Library Platform",
    description: "Your documents, searchable and conversational. Upload PDFs, search semantically, chat with AI grounded in your content.",
    siteName: "Athenaeum",
    type: "website",
    url: "https://athenaeum.herakles.dev",
  },
  twitter: {
    card: "summary",
    title: "Athenaeum — Semantic Library Platform",
    description: "Your documents, searchable and conversational.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className="min-h-screen"
        style={{ background: "var(--bg)", color: "var(--text)" }}
      >
        <AuthProvider>
          <Nav />
          <main className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-8">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
