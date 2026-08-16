"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) { return <div className="route-error page-frame"><p className="kicker">Protocol interruption</p><h1>That view lost its signal.</h1><p>Nothing was signed. Retry the view or return to the estate overview.</p><div className="flex flex-wrap gap-3"><button className="button button-primary" onClick={() => reset()}>Retry view ↻</button><a className="button button-ghost" href="/">Return home</a></div></div>; }
