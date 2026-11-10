import { Globe, Lock, Music, Smartphone, SlidersHorizontal, UserX } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useReveal } from "@/hooks/useAnime";

const FEATURES: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: SlidersHorizontal,
    title: "Pick your quality",
    text: "Choose the resolution for video, from 144p up to 4K when the source has it, and the bitrate for audio, from 64 to 320 kbps.",
  },
  {
    icon: Music,
    title: "MP4 or MP3",
    text: "Keep the whole video, or grab only the sound as a clean MP3 with the title tagged in.",
  },
  {
    icon: Globe,
    title: "1000+ sites",
    text: "YouTube, Shorts, TikTok, Facebook, Pinterest, Instagram, X, Reddit and many more, all from one box.",
  },
  {
    icon: UserX,
    title: "No sign-up",
    text: "No account, no extension, nothing to install. Paste a link, pick a format, download.",
  },
  {
    icon: Lock,
    title: "Private by design",
    text: "Your file is deleted from our server a few minutes after it's ready. We don't keep a library of your downloads.",
  },
  {
    icon: Smartphone,
    title: "Works on any device",
    text: "Phone, tablet or desktop. If it has a modern browser, it can download.",
  },
];

export function Features() {
  const ref = useReveal({ gap: 70 });
  return (
    <section id="features" className="px-4 py-16 sm:py-24">
      <div ref={ref} className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <p data-reveal className="text-sm font-semibold tracking-widest text-primary uppercase">
            Features
          </p>
          <h2 data-reveal className="mt-3 text-3xl font-bold sm:text-4xl">
            Everything you need. Nothing you don't.
          </h2>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              data-reveal
              className="group rounded-3xl border bg-card p-7 transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:bg-accent/40"
            >
              <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/12 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <Icon className="size-6" />
              </div>
              <h3 className="mt-5 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
