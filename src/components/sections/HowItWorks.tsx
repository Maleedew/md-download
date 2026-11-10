import { useReveal } from "@/hooks/useAnime";

const STEPS = [
  { n: "01", title: "Paste the link", text: "Copy the video's address from the app or browser and drop it in the box." },
  { n: "02", title: "Choose format & quality", text: "Pick MP4 or MP3, then the resolution or bitrate that suits you." },
  { n: "03", title: "Download", text: "We prepare the file and your browser saves it. That's it." },
];

export function HowItWorks() {
  const ref = useReveal({ gap: 120 });
  return (
    <section id="how" className="px-4 py-16 sm:py-24">
      <div ref={ref} className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <p data-reveal className="text-sm font-semibold tracking-widest text-primary uppercase">
            How it works
          </p>
          <h2 data-reveal className="mt-3 text-3xl font-bold sm:text-4xl">
            Three steps. About ten seconds.
          </h2>
        </div>
        <ol className="mt-12 grid gap-4 md:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n} data-reveal className="relative overflow-hidden rounded-3xl border bg-card p-8">
              <span className="font-display text-7xl leading-none font-bold text-primary/20">{s.n}</span>
              <h3 className="mt-4 text-xl font-semibold">{s.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
