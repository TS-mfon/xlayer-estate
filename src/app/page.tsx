import Link from "next/link";
import { BuildSequence } from "@/components/BuildSequence";

export default function Home() {
  return (
    <div>
      <section className="page-frame hero">
        <div>
          <p className="kicker">AI underwriting / X Layer settlement</p>
          <h1>Make real estate <em>legible</em> to the chain.</h1>
          <p>
            XLayer Estate turns property documents into verified, risk-scored,
            fractional assets. One continuous path from evidence to ownership.
          </p>
          <div className="hero-actions">
            <Link href="/tokenize" className="button button-primary">Start underwriting ↗</Link>
            <Link href="/dashboard" className="button button-ghost">Explore registry</Link>
          </div>
        </div>
        <div className="hero-terminal" aria-label="XLayer Estate system preview">
          <div className="terminal-top"><i /> <span>estate_agent / live_underwriting</span></div>
          <div className="terminal-body">
            <div><span className="cyan">$</span> ingest <strong>property-deed.pdf</strong></div>
            <div><span className="violet">→</span> extracting ownership, area, title_status</div>
            <div><span className="violet">→</span> running Gemini / confidence: <strong>0.94</strong></div>
            <div><span className="violet">→</span> valuation_usd: <strong>1,240,000</strong></div>
            <div><span className="violet">→</span> risk_score: <strong>18 / 100</strong></div>
            <div><span className="violet">→</span> report_hash: <strong>0x8a…f42c</strong></div>
            <div className="mt-6"><span className="cyan">●</span> ready to tokenize on <strong>X Layer / 1952</strong></div>
          </div>
        </div>
      </section>

      <BuildSequence />

      <section className="page-frame section">
        <div className="section-heading">
          <div><p className="kicker">Built for verifiable RWA</p><h2>Evidence first.<br />Ownership next.</h2></div>
          <p>AI does the reading. The chain preserves the result. Your asset remains understandable long after the upload is gone.</p>
        </div>
        <div className="dashboard-grid">
          {["Structured underwriting", "Tamper-evident reports", "Fractional ERC-1155 shares"].map((item, i) => (
            <div className="glass-panel p-5" key={item}>
              <p className="kicker">0{i + 1}</p><h3 className="mt-10 text-lg font-semibold">{item}</h3>
              <p className="mt-2 text-sm leading-6 text-white/50">{["Extract property facts, value, and risk from everyday documents.", "Verify the exact report bytes against a keccak256 hash on-chain.", "Mint a programmable supply of ownership units on X Layer."][i]}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
