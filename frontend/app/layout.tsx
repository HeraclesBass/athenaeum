import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import { AuthProvider } from "@/lib/auth";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0c0e12",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://athenaeum.herakles.dev"),
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
    <html lang="en" className={inter.variable}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "Athenaeum",
              url: "https://athenaeum.herakles.dev",
              description: "Upload documents, search semantically, and chat with AI that cites its sources.",
              applicationCategory: "UtilityApplication",
            }),
          }}
        />
      </head>
      <body
        className="min-h-screen"
        style={{ background: "var(--bg)", color: "var(--text)" }}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm focus:font-medium"
          style={{ background: "var(--accent)", color: "#080c14" }}
        >
          Skip to main content
        </a>
        <AuthProvider>
          <Nav />
          <main id="main-content" className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-8">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
