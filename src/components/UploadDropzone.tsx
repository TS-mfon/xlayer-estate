"use client";

import { useRef, useState } from "react";

export function UploadDropzone({ onFile, onImage, loading }: { onFile: (file: File) => void; onImage?: (file: File) => void; loading?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const handle = (files?: FileList | null) => { const file = files?.[0]; if (file) onFile(file); };

  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") inputRef.current?.click(); }}
      onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => { event.preventDefault(); setDragging(false); handle(event.dataTransfer.files); }}
      onClick={() => inputRef.current?.click()}
      className={`glass-panel group relative grid min-h-[360px] cursor-pointer place-items-center overflow-hidden border-dashed p-8 text-center transition duration-500 ${dragging ? "border-cyan-200/70 bg-cyan-200/10" : "hover:border-cyan-200/35"}`}
    >
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,.pdf,.txt,.md,.csv,.json" className="hidden" onChange={(event) => handle(event.target.files)} />
      <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(98,230,255,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(98,230,255,.12)_1px,transparent_1px)] [background-size:34px_34px] [mask-image:radial-gradient(circle,black,transparent_75%)]" />
      <div className="relative">
        <div className={`mx-auto mb-6 grid h-20 w-20 place-items-center rounded-3xl border border-cyan-200/20 bg-cyan-200/5 text-3xl shadow-[0_0_50px_rgba(77,224,255,.14)] ${loading ? "animate-pulse" : "transition duration-500 group-hover:-translate-y-2 group-hover:scale-105"}`}>{loading ? "◌" : "⇧"}</div>
        <p className="kicker">{loading ? "Agent is reading" : "Source document"}</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">{loading ? "Inspecting the asset…" : "Drop an asset photo or record here"}</h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-white/45">Laptops, cups, cameras, watches, furniture, vehicles, collectibles, equipment, or other physical goods. A clear photo is enough to start; confidential documents are optional. Maximum file size 4 MB.</p>
      </div>
    </div>
  );
}
