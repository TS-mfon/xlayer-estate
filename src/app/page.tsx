import Link from "next/link";

const steps = [
  {
    n: "1",
    title: "Upload the deed",
    body: "Drop a property title, valuation report, or listing. PDFs, images, and text are supported.",
  },
  {
    n: "2",
    title: "AI underwrites it",
    body: "A Gemini-powered agent extracts structured data, estimates fair value, and scores risk flags.",
  },
  {
    n: "3",
    title: "Tokenize on X Layer",
    body: "Mint the asset as an ERC-1155 with an on-chain record of valuation, risk, and a tamper-proof report hash.",
  },
];

export default function Home() {
  return (
    <div className="space-y-16">
      <section className="pt-10 text-center">
        <span className="inline-block rounded-full bg-brand/15 px-3 py-1 text-xs text-brand-glow">
          BuildX AI Season · AI-RWA track
        </span>
        <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">
          Turn real estate into on-chain assets with an{" "}
          <span className="bg-gradient-to-r from-brand to-brand-glow bg-clip-text text-transparent">
            AI underwriting agent
          </span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-white/60">
          XLayer Estate reads a property document, values it, scores the risk, and mints a
          fractional RWA token on X Layer — in minutes.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/tokenize" className="btn btn-primary">
            Start tokenizing
          </Link>
          <Link href="/dashboard" className="btn btn-ghost">
            View assets
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {steps.map((s) => (
          <div key={s.n} className="glass rounded-2xl p-6">
            <div className="mb-3 grid h-9 w-9 place-items-center rounded-lg bg-brand/20 font-bold text-brand-glow">
              {s.n}
            </div>
            <h3 className="font-semibold">{s.title}</h3>
            <p className="mt-1 text-sm text-white/60">{s.body}</p>
          </div>
        ))}
      </section>

      <section className="glass rounded-2xl p-6">
        <h3 className="font-semibold">Why this fits the AI-RWA track</h3>
        <p className="mt-2 text-sm text-white/60">
          The build pairs a real AI capability (document understanding + valuation) with a real
          on-chain primitive (ERC-1155 RWA tokens on X Layer). Each token carries an on-chain
          underwriting hash for verifiable provenance — the exact profile the dedicated AI-RWA
          liquidity grant rewards.
        </p>
      </section>
    </div>
  );
}
