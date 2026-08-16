import "./globals.css";
import type { Metadata } from "next";
import { Providers } from "./providers";
import { Nav } from "@/components/Nav";
import { ProtocolAtmosphere } from "@/components/ProtocolAtmosphere";

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
          <ProtocolAtmosphere />
          <Nav />
          <main className="site-main">{children}</main>
          <footer className="protocol-footer"><div><span className="brand-mark">✦</span><div><strong>XLayer Estate</strong><p>AI-underwritten physical assets. Fractional markets. X Layer settlement.</p></div></div><div><span>REGISTRY / 1952</span><span>USDC_TEST MARKETS</span><span>SELF-ATTESTED ASSETS</span></div></footer>
        </Providers>
      </body>
    </html>
  );
}
