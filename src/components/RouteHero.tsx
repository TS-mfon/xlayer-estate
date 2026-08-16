"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

export function RouteHero({ eyebrow, title, description, aside, actions }: { eyebrow: string; title: ReactNode; description: string; aside?: ReactNode; actions?: ReactNode }) {
  return <motion.header className="route-hero" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .75, ease: [.22, 1, .36, 1] }}>
    <div className="route-hero-copy"><p className="kicker">{eyebrow}</p><h1>{title}</h1><p>{description}</p>{actions && <div className="route-hero-actions">{actions}</div>}</div>
    <div className="route-hero-visual"><div className="route-hero-monolith"><span className="monolith-core">✦</span><span className="monolith-ring ring-one"/><span className="monolith-ring ring-two"/><span className="monolith-label">X LAYER / 1952</span></div>{aside && <div className="route-hero-aside">{aside}</div>}</div>
  </motion.header>;
}

export function RouteMetric({ label, value, tone = "cyan" }: { label: string; value: string; tone?: "cyan" | "amber" | "green" }) {
  return <div className={`route-metric tone-${tone}`}><span>{label}</span><strong>{value}</strong></div>;
}
