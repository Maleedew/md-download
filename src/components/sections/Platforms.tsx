import { PLATFORMS } from "@/lib/platforms";
import { useReveal } from "@/hooks/useAnime";

export function Platforms() {
  const ref = useReveal();
  const row = [...PLATFORMS, ...PLATFORMS];
  return (
    <section id="platforms" className="py-16 sm:py-20">
      <div ref={ref}>
        <div className="mx-auto max-w-3xl px-4 text-center">
          <p data-reveal className="text-sm font-semibold tracking-widest text-primary uppercase">
            Platforms
          </p>
          <h2 data-reveal className="mt-3 text-3xl font-bold sm:text-4xl">
            Works with the sites you actually use
          </h2>
        </div>
        <div
          data-reveal
          className="relative mt-10 overflow-hidden [mask-image:linear-gradient(to_right,transparent,var(--black)_12%,var(--black)_88%,transparent)]"
        >
          <div className="marquee gap-3 py-2">
            {row.map((name, i) => (
              <span
                key={`${name}-${i}`}
                aria-hidden={i >= PLATFORMS.length}
                className="mr-3 inline-flex shrink-0 items-center gap-2.5 rounded-full border bg-card px-6 py-3 text-sm font-semibold"
              >
                <span className="size-2 rounded-full bg-primary" />
                {name}
              </span>
            ))}
          </div>
        </div>
        <p data-reveal className="mt-6 px-4 text-center text-sm text-muted-foreground">
          …and over a thousand more supported sites.
        </p>
      </div>
    </section>
  );
}
