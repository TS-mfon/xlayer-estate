"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { WalletButton } from "./WalletButton";

const links = [
  { href: "/", label: "Overview" },
  { href: "/tokenize", label: "Underwrite" },
  { href: "/dashboard", label: "Registry" },
  { href: "/marketplace", label: "Marketplace" },
];

export function Nav() {
  const pathname = usePathname();
  const [sequenceComplete, setSequenceComplete] = useState(pathname !== "/");
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (pathname !== "/") { setSequenceComplete(true); return; }
    const complete = () => setSequenceComplete(true);
    const active = () => setSequenceComplete(false);
    window.addEventListener("xlayer:sequence-complete", complete);
    window.addEventListener("xlayer:sequence-active", active);
    return () => {
      window.removeEventListener("xlayer:sequence-complete", complete);
      window.removeEventListener("xlayer:sequence-active", active);
    };
  }, [pathname]);
  useEffect(() => setMobileOpen(false), [pathname]);
  return (
    <header className={`nav-shell ${pathname === "/" && !sequenceComplete ? "nav-sequence-hidden" : ""} ${mobileOpen ? "mobile-open" : ""}`}>
      <div className="nav-inner">
        <Link href="/" className="brand"><span className="brand-mark">✦</span><span><strong>XLayer</strong> Estate</span></Link>
        <nav className="nav-links" aria-label="Primary navigation">
          {links.map((link) => <Link key={link.href} href={link.href} className={pathname === link.href ? "active" : ""}>{link.label}</Link>)}
        </nav>
        <div className="nav-wallet"><WalletButton /></div>
        <button className="nav-mobile-toggle" aria-label="Toggle navigation" aria-expanded={mobileOpen} onClick={() => setMobileOpen((open) => !open)}><span/><span/><span/></button>
      </div>
      <div className="nav-mobile-panel">{links.map((link, index) => <Link key={link.href} href={link.href}><span>0{index + 1}</span>{link.label}</Link>)}<WalletButton /></div>
    </header>
  );
}
