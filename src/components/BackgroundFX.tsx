import { useEffect, useRef } from "react";
import { animate } from "animejs";
import { prefersReducedMotion } from "@/lib/utils";

const ORBS = [
  { size: 560, left: "8%", top: "-14%", dx: 140, dy: 80, scale: 1.25, duration: 14000 },
  { size: 420, left: "62%", top: "6%", dx: -120, dy: 110, scale: 1.35, duration: 17000 },
  { size: 340, left: "34%", top: "38%", dx: 90, dy: -90, scale: 1.2, duration: 19000 },
];

/** Drifting electric-blue glow + grid. Sits behind everything. */
export function BackgroundFX() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefersReducedMotion() || !root.current) return;
    const anims = Array.from(root.current.querySelectorAll<HTMLElement>("[data-orb]")).map((el, i) => {
      const o = ORBS[i];
      return animate(el, {
        translateX: o.dx,
        translateY: o.dy,
        scale: o.scale,
        duration: o.duration,
        ease: "inOutSine",
        loop: true,
        alternate: true,
      });
    });
    return () => anims.forEach((a) => a.pause());
  }, []);

  return (
    <div ref={root} aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="bg-grid absolute inset-0" />
      {ORBS.map((o, i) => (
        <div
          key={i}
          data-orb
          className="absolute rounded-full bg-electric/25 blur-[110px] will-change-transform"
          style={{ width: o.size, height: o.size, left: o.left, top: o.top }}
        />
      ))}
    </div>
  );
}
