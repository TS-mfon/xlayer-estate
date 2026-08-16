"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export function ProtocolAtmosphere() {
  const pathname = usePathname();

  useEffect(() => {
    const move = (event: PointerEvent) => {
      document.documentElement.style.setProperty("--pointer-x", `${event.clientX}px`);
      document.documentElement.style.setProperty("--pointer-y", `${event.clientY}px`);
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, []);

  if (pathname === "/") return null;
  return <div className="protocol-atmosphere" aria-hidden="true"><div className="protocol-grid"/><div className="protocol-pointer"/><div className="protocol-beam beam-a"/><div className="protocol-beam beam-b"/><div className="protocol-orbit orbit-a"/><div className="protocol-orbit orbit-b"/><div className="protocol-noise"/></div>;
}
