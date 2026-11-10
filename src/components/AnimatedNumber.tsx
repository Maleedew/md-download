import { useEffect, useRef } from "react";
import { animate } from "animejs";
import { prefersReducedMotion } from "@/lib/utils";

/** Counts smoothly to `value` (anime.js tweens a plain object and we paint the text). */
export function AnimatedNumber({ value, suffix = "%", className }: { value: number; suffix?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const box = useRef({ v: 0 });

  useEffect(() => {
    const paint = (n: number) => {
      if (ref.current) ref.current.textContent = `${Math.round(n)}${suffix}`;
    };
    if (prefersReducedMotion()) {
      box.current.v = value;
      paint(value);
      return;
    }
    const a = animate(box.current, {
      v: value,
      duration: 650,
      ease: "outQuad",
      onUpdate: () => paint(box.current.v),
    });
    return () => {
      a.pause();
    };
  }, [value, suffix]);

  return (
    <span ref={ref} className={className}>
      0{suffix}
    </span>
  );
}
