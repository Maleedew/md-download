import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Downloader } from "@/components/Downloader";
import { useReveal } from "@/hooks/useAnime";

export function Hero() {
  const ref = useReveal({ immediate: true, gap: 110 });
  return (
    <section id="top" className="px-4 pt-14 pb-20 sm:pt-24 sm:pb-28">
      <div ref={ref} className="mx-auto max-w-4xl text-center">
        <Badge data-reveal className="mx-auto">
          <Sparkles /> Free · No sign-up · MP4 &amp; MP3
        </Badge>
        <h1 data-reveal className="mt-7 text-[2.6rem] leading-[1.04] font-bold sm:text-7xl">
          Download any video.
          <br />
          <span className="text-primary">In the quality you choose.</span>
        </h1>
        <p data-reveal className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          Paste a link from YouTube, Shorts, TikTok, Facebook, Pinterest and 1000+ other sites. Save it as MP4 video or MP3
          audio, with the exact resolution or bitrate you want.
        </p>
        <div data-reveal className="mt-10 sm:mt-12">
          <Downloader />
        </div>
      </div>
    </section>
  );
}
