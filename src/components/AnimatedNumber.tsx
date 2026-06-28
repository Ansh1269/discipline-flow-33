import { useEffect, useRef, useState } from "react";

interface Props {
  value: number;
  duration?: number;
  decimals?: number;
  className?: string;
  suffix?: string;
  prefix?: string;
}

export function AnimatedNumber({ value, duration = 900, decimals = 0, className, suffix, prefix }: Props) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { setDisplay(value); fromRef.current = value; return; }
    const from = fromRef.current;
    const to = value;
    if (from === to) return;
    startRef.current = null;
    const step = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const p = Math.min(1, (ts - startRef.current) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (to - from) * eased);
      if (p < 1) rafRef.current = requestAnimationFrame(step);
      else fromRef.current = to;
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value, duration]);

  return (
    <span className={className}>
      {prefix}{display.toFixed(decimals)}{suffix}
    </span>
  );
}