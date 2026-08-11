"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SceneCanvas } from "./SceneCanvas";

gsap.registerPlugin(ScrollTrigger);

const stages = [
  { eyebrow: "01 / INGEST", title: "A document enters the pipeline", body: "Upload a deed, valuation, title, or listing and turn unstructured property data into a machine-readable asset." },
  { eyebrow: "02 / UNDERWRITE", title: "Gemini finds the signal", body: "The underwriting agent extracts ownership, area, title status, valuation range, and risk flags." },
  { eyebrow: "03 / VERIFY", title: "Every claim gets a fingerprint", body: "The canonical report is hashed with keccak256 so the evidence can be checked against the on-chain record." },
  { eyebrow: "04 / TOKENIZE", title: "A real-world asset becomes programmable", body: "Valuation, risk, and metadata are recorded while the property is minted as fractional ERC-1155 shares on X Layer." },
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
          end: "+=4200",
          pin: true,
          scrub: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => setProgress(self.progress),
          onLeave: () => window.dispatchEvent(new Event("xlayer:sequence-complete")),
          onEnterBack: () => window.dispatchEvent(new Event("xlayer:sequence-active")),
        },
      });

      cards.forEach((card, index) => {
        timeline.fromTo(card, { y: 38, opacity: 0, scale: 0.94 }, { y: 0, opacity: 1, scale: 1, duration: 0.65, ease: "none" }, index * 0.9);
      });
      timeline.fromTo(".build-logo", { opacity: 0, scale: 0.6, filter: "blur(14px)" }, { opacity: 1, scale: 1, filter: "blur(0px)", duration: 0.8, ease: "none" }, 3.7);
      timeline.fromTo(".build-nav-reveal", { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.45, ease: "none" }, 4.45);
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
