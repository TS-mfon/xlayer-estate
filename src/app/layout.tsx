import "./globals.css";
import type { Metadata } from "next";
import { Providers } from "./providers";
import { Nav } from "@/components/Nav";
import { ProtocolAtmosphere } from "@/components/ProtocolAtmosphere";

export const metadata: Metadata = {
  metadataBase: new URL("https://xlayer-estate.vercel.app"),
  title: { default: "XLayer Estate — AI Physical Asset Protocol", template: "%s · XLayer Estate" },
  description:
    "Upload a physical asset photo, receive a conservative AI valuation, and tokenize fractional shares on X Layer.",
  applicationName: "XLayer Estate",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", shortcut: "/icon.svg", apple: "/icon.svg" },
  openGraph: { title: "XLayer Estate", description: "AI-underwritten physical assets with fractional X Layer markets.", url: "https://xlayer-estate.vercel.app", siteName: "XLayer Estate", type: "website" },
  twitter: { card: "summary", title: "XLayer Estate", description: "AI-underwritten physical assets with fractional X Layer markets." },
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
          <ProtocolAtmosphere />
          <Nav />
          <main className="site-main">{children}</main>
          <footer className="protocol-footer"><div><span className="brand-mark"><img src="/icon.svg" alt="" /></span><div><strong>XLayer Estate</strong><p>AI-underwritten physical assets. Fractional markets. X Layer settlement.</p></div></div><div><span>TESTNET 1952 / MAINNET 196</span><span>USDC MARKETS</span><span>SELF-ATTESTED ASSETS</span></div></footer>
        </Providers>
      </body>
    </html>
  );
}
