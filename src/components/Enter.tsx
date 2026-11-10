import { useLayoutEffect, useRef, type ReactNode } from "react";
import { animate } from "animejs";
import { cn, prefersReducedMotion } from "@/lib/utils";

/** Fades + lifts its content in when it mounts (use `key` to replay). */
export function Enter({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    const a = animate(el, {
      opacity: [0, 1],
      translateY: [18, 0],
      duration: 650,
      delay,
      ease: "outExpo",
      onComplete: () => {
        el.style.transform = "";
      },
    });
    return () => {
      a.pause();
      el.style.opacity = "1";
    };
  }, [delay]);
  return (
    <div ref={ref} className={cn(className)}>
      {children}
    </div>
  );
}
