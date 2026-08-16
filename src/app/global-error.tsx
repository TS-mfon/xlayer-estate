"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) { return <html><body><main className="route-error page-frame"><p className="kicker">XLayer Estate</p><h1>Protocol UI unavailable.</h1><button className="button button-primary" onClick={() => reset()}>Reload ↻</button></main></body></html>; }
