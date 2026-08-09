"use client";

import { useRef, useState } from "react";

export function UploadDropzone({
  onFile,
  loading,
}: {
  onFile: (file: File) => void;
  loading?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const handle = (files?: FileList | null) => {
    const f = files?.[0];
    if (f) onFile(f);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        handle(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center transition ${
        drag ? "border-brand-glow bg-white/5" : "border-white/15 hover:border-white/30"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf,.txt,.md,.csv,.json"
        className="hidden"
        onChange={(e) => handle(e.target.files)}
      />
      {loading ? (
        <p className="text-white/70">Analyzing document with AI…</p>
      ) : (
        <>
          <div className="mb-3 text-3xl">🏠</div>
          <p className="font-medium">Drop a property document here</p>
          <p className="mt-1 text-sm text-white/50">
            Deed, title, valuation report, or listing (PDF / image / text)
          </p>
        </>
      )}
    </div>
  );
}
