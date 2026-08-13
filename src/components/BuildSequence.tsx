"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SceneCanvas } from "./SceneCanvas";

gsap.registerPlugin(ScrollTrigger);

const stages = [
  { eyebrow: "01 / CAPTURE", title: "A physical object enters the frame", body: "Upload a clear photo of a laptop, cup, camera, watch, vehicle, collectible, tool, or other lawful physical item—without exposing confidential ownership documents." },
  { eyebrow: "02 / IDENTIFY", title: "Gemini recognizes the asset", body: "The visual agent identifies category, visible brand or model, condition, and non-sensitive evidence while rejecting manipulated, prohibited, or unrecognizable uploads." },
  { eyebrow: "03 / VALUE", title: "Resale value becomes structured", body: "The agent estimates a conservative second-hand USD range, uses the lower bound for launch pricing, and attaches confidence and risk signals." },
  { eyebrow: "04 / TOKENIZE", title: "The asset becomes programmable", body: "A signed EIP-712 authorization binds the report, image, wallet, valuation, and keccak256 hashes before one million ERC-1155 shares are minted." },
  { eyebrow: "05 / LIQUIDITY", title: "A market assembles around it", body: "The issuer seeds at least 10 USDC_TEST, permanent liquidity locks, and buyers or sellers trade with transparent fixed 0.20 USDC platform fees." },
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
          end: "+=5200",
          pin: true,
          scrub: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => setProgress(self.progress),
          onLeave: () => window.dispatchEvent(new Event("xlayer:sequence-complete")),
          onEnterBack: () => window.dispatchEvent(new Event("xlayer:sequence-active")),
        },
      });

      cards.forEach((card, index) => {
        timeline.fromTo(card, { y: 44, opacity: 0, scale: 0.91, filter: "blur(10px)" }, { y: 0, opacity: 1, scale: 1, filter: "blur(0px)", duration: 0.72, ease: "none" }, index * 0.92);
      });
      timeline.fromTo(".build-logo", { opacity: 0, scale: 0.55, filter: "blur(16px)" }, { opacity: 1, scale: 1, filter: "blur(0px)", duration: 0.85, ease: "none" }, 4.62);
      timeline.fromTo(".build-nav-reveal", { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.5, ease: "none" }, 5.38);
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
