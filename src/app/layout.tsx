import "./globals.css";
import type { Metadata } from "next";
import { Providers } from "./providers";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "XLayer Estate — AI Real Estate Tokenization",
  description:
    "Upload a property document, let an AI agent underwrite it, and tokenize it on-chain with X Layer.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Nav />
          <main className="mx-auto w-full max-w-6xl px-4 py-8">{children}</main>
          <footer className="mx-auto w-full max-w-6xl px-4 py-10 text-sm text-white/40">
            Built for the X Layer BuildX AI Season Hackathon · AI-RWA track
          </footer>
        </Providers>
      </body>
    </html>
  );
}
