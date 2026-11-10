import { useEffect, useLayoutEffect, useRef } from "react";
import { animate, stagger } from "animejs";
import { prefersReducedMotion } from "@/lib/utils";

interface RevealOptions {
  /** CSS selector (inside the container) of the elements to reveal. */
  selector?: string;
  /** Play right away instead of waiting until the container scrolls into view. */
  immediate?: boolean;
  /** Pixels to slide in from. */
  distance?: number;
  /** Delay between children in ms. */
  gap?: number;
}

/**
 * Staggered fade-and-slide reveal powered by anime.js.
 * Elements start hidden (before first paint, so there is no flash) and animate in once.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>({
  selector = "[data-reveal]",
  immediate = false,
  distance = 28,
  gap = 90,
}: RevealOptions = {}) {
  const ref = useRef<T>(null);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || prefersReducedMotion()) return;
    root.querySelectorAll<HTMLElement>(selector).forEach((el) => (el.style.opacity = "0"));
  }, [selector]);

  useEffect(() => {
    const root = ref.current;
    if (!root || prefersReducedMotion()) return;
    const targets = Array.from(root.querySelectorAll<HTMLElement>(selector));
    if (!targets.length) return;

    let anim: ReturnType<typeof animate> | undefined;
    const play = () => {
      anim = animate(targets, {
        opacity: [0, 1],
        translateY: [distance, 0],
        duration: 800,
        delay: stagger(gap),
        ease: "outExpo",
        onComplete: () => targets.forEach((el) => (el.style.transform = "")),
      });
    };

    if (immediate || typeof IntersectionObserver === "undefined") {
      play();
      return () => {
        anim?.pause();
        targets.forEach((el) => (el.style.opacity = "1"));
      };
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          play();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(root);
    return () => {
      io.disconnect();
      anim?.pause();
      targets.forEach((el) => (el.style.opacity = "1"));
    };
  }, [selector, immediate, distance, gap]);

  return ref;
}
