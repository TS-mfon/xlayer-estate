"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import dynamic from "next/dynamic";

const SceneCanvas = dynamic(() => import("./SceneCanvas").then((module) => module.SceneCanvas), {
  ssr: false,
  loading: () => <div className="scene-canvas scene-canvas-loading" aria-hidden="true"><span>✦</span></div>,
});

gsap.registerPlugin(ScrollTrigger);

const stages = [
  { eyebrow: "01 / CAPTURE", title: "A physical object enters the frame", body: "Upload a clear photo of a laptop, cup, camera, watch, vehicle, collectible, tool, or other lawful physical item—without exposing confidential ownership documents." },
  { eyebrow: "02 / INSPECT", title: "AI extracts claims, not authority", body: "Gemini identifies the object, condition, and comparable market signals. Deterministic policy—not model prose—decides whether the evidence can progress." },
  { eyebrow: "03 / PASSPORT", title: "Evidence becomes a versioned Passport", body: "Content hashes, confidence, valuation, risk, and policy version assemble into a tamper-evident record that can be superseded without rewriting history." },
  { eyebrow: "04 / ISSUE", title: "The Passport becomes programmable", body: "A typed authorization binds the Passport, recipient, metadata, supply, chain, nonce, and expiry before ERC-1155 shares are issued." },
  { eyebrow: "05 / LIQUIDITY", title: "A bounded market assembles", body: "The issuer opens an isolated pool. Reserve depth, slippage limits, asset status, and locked liquidity protect traders from thin-market execution." },
];

export function BuildSequence() {
  const root = useRef<HTMLElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      window.dispatchEvent(new Event("xlayer:sequence-complete"));
      return;
    }
    const context = gsap.context(() => {
      const cards = gsap.utils.toArray<HTMLElement>(".build-stage");
      const timeline = gsap.timeline({
        scrollTrigger: {
          trigger: root.current,
          start: "top top",
          end: () => `+=${Math.max(window.innerHeight * 5.5, 3600)}`,
          pin: true,
          scrub: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => setProgress(self.progress),
          onLeave: () => window.dispatchEvent(new Event("xlayer:sequence-complete")),
          onEnterBack: () => window.dispatchEvent(new Event("xlayer:sequence-active")),
        },
      });

      cards.forEach((card, index) => {
        const start = index * 1.02;
        timeline.fromTo(card, { y: 44, opacity: 0, scale: 0.91, filter: "blur(10px)" }, { y: 0, opacity: 1, scale: 1, filter: "blur(0px)", duration: 0.62, ease: "none" }, start);
        if (index < cards.length - 1) timeline.to(card, { y: -22, opacity: 0.08, scale: 0.97, duration: 0.42, ease: "none" }, start + 0.68);
      });
      timeline.fromTo(".build-logo", { opacity: 0, scale: 0.55, filter: "blur(16px)" }, { opacity: 1, scale: 1, filter: "blur(0px)", duration: 0.85, ease: "none" }, 5.18);
      timeline.fromTo(".build-nav-reveal", { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.5, ease: "none" }, 5.82);
    }, root);
    return () => context.revert();
  }, []);

  return (
    <section ref={root} className="build-sequence" aria-label="How XLayer Estate works">
      <div className="build-grid" />
      <div ref={progressRef} className="build-progress" style={{ transform: `scaleX(${progress})` }} />
      <div className="build-copy">
        <p className="kicker">THE ASSET PIPELINE</p>
        <div className="build-stages">
          {stages.map((stage) => (
            <article className="build-stage" key={stage.eyebrow}>
              <p className="kicker">{stage.eyebrow}</p>
              <h2>{stage.title}</h2>
              <p>{stage.body}</p>
            </article>
          ))}
        </div>
        <div className="build-logo" aria-hidden="true"><span>✦</span> XLayer Estate</div>
        <div className="build-nav-reveal"><a className="button button-primary" href="/tokenize">Tokenize an asset ↗</a></div>
      </div>
      <SceneCanvas progress={progress} />
    </section>
  );
}
