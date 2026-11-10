import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useReveal } from "@/hooks/useAnime";

const FAQ = [
  {
    q: "Which websites are supported?",
    a: "YouTube (including Shorts), TikTok, Facebook, Instagram, Pinterest, X, Reddit, Vimeo, Dailymotion, SoundCloud and over a thousand more. If you can watch the video in a browser without signing in, it usually works.",
  },
  {
    q: "Why did my link fail?",
    a: "Private, age-restricted, members-only, DRM-protected and live videos can't be downloaded. Some platforms also slow down automated requests, so if a link that should work fails, wait a few minutes and try again. Very long videos or very large files may be refused.",
  },
  {
    q: "What do the quality options mean?",
    a: "For MP4, 1080p means 1080 pixels on the short side of the frame, so it applies to vertical videos too. Only resolutions that exist at the source are listed. For MP3 the number is the bitrate: higher means a bigger file and better sound, but it can't beat the quality of the original audio.",
  },
  {
    q: "Is it really free?",
    a: "Yes. There's no sign-up and no payment. To keep the service fast for everyone there are fair-use limits on how many downloads you can start per minute.",
  },
  {
    q: "How long are my files kept?",
    a: "Only a few minutes, long enough for your browser to save them. After that they're deleted automatically.",
  },
  {
    q: "Is downloading videos legal?",
    a: "md download is a tool, not a licence. Only save content that you own, that is licensed for reuse, or that you have permission to download, and respect creators and each platform's terms of service.",
  },
];

export function Faq() {
  const ref = useReveal({ gap: 80 });
  return (
    <section id="faq" className="px-4 py-16 sm:py-24">
      <div ref={ref} className="mx-auto max-w-3xl">
        <div className="text-center">
          <p data-reveal className="text-sm font-semibold tracking-widest text-primary uppercase">
            FAQ
          </p>
          <h2 data-reveal className="mt-3 text-3xl font-bold sm:text-4xl">
            Questions, answered
          </h2>
        </div>
        <Accordion type="single" collapsible className="mt-12 flex flex-col gap-3">
          {FAQ.map((item, i) => (
            <div key={item.q} data-reveal>
              <AccordionItem value={`q${i}`}>
                <AccordionTrigger>{item.q}</AccordionTrigger>
                <AccordionContent>{item.a}</AccordionContent>
              </AccordionItem>
            </div>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
