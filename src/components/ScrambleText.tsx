"use client";

import { useEffect, useState } from "react";

const CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+~|}{[]:;?><";

export function ScrambleIn({ text, delay = 0, triggered }: { text: string; delay?: number; triggered: boolean }) {
  const [value, setValue] = useState("\u00a0");
  useEffect(() => {
    if (!triggered) { setValue("\u00a0"); return; }
    let cursor = 0; let timer: ReturnType<typeof setInterval>;
    const start = setTimeout(() => { timer = setInterval(() => { cursor += 0.5; setValue(text.split("").map((char, index) => char === " " ? " " : index < cursor ? char : index < cursor + 3 ? CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)] : "").join("")); if (cursor >= text.length) { clearInterval(timer); setValue(text); } }, 25); }, delay);
    return () => { clearTimeout(start); clearInterval(timer); };
  }, [delay, text, triggered]);
  return <>{value}</>;
}

export function ScrambleText({ text, isHovered, className }: { text: string; isHovered: boolean; className?: string }) {
  const [value, setValue] = useState(text);
  useEffect(() => {
    if (!isHovered) { setValue(text); return; }
    let frame = 0; const timer = setInterval(() => { frame += 1; const revealed = Math.floor(frame / 4); setValue(text.split("").map((char, index) => char === " " ? " " : index < revealed ? char : CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)]).join("")); if (revealed >= text.length) { clearInterval(timer); setValue(text); } }, 25);
    return () => clearInterval(timer);
  }, [isHovered, text]);
  return <span className={className}>{value}</span>;
}
