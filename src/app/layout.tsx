import "./globals.css";
import type { Metadata } from "next";
import { Providers } from "./providers";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "XLayer Estate — AI Physical Asset Tokenization",
  description:
    "Upload a physical asset photo, receive a conservative AI valuation, and tokenize fractional shares on X Layer.",
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
          <main className="site-main">{children}</main>
          <footer className="page-frame !py-8 text-sm text-white/35">
            Built for the X Layer BuildX AI Season Hackathon · AI-RWA track
          </footer>
        </Providers>
      </body>
    </html>
  );
}
