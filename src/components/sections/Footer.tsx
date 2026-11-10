import { Logo } from "@/components/sections/Header";

export function Footer() {
  return (
    <footer className="px-4 pb-10">
      <div className="mx-auto max-w-6xl rounded-3xl border bg-card p-8 sm:p-10">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <Logo />
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Paste a link. Pick MP4 or MP3. Choose the quality. Download.
            </p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-8 gap-y-3 text-sm font-medium text-muted-foreground">
            <a className="transition-colors hover:text-foreground" href="#platforms">Platforms</a>
            <a className="transition-colors hover:text-foreground" href="#features">Features</a>
            <a className="transition-colors hover:text-foreground" href="#how">How it works</a>
            <a className="transition-colors hover:text-foreground" href="#faq">FAQ</a>
          </nav>
        </div>
        <div className="mt-8 border-t pt-6 text-xs leading-relaxed text-muted-foreground">
          <p>
            md download is meant for saving content you own or have permission to download. Respect creators and each
            platform's terms of service. Not affiliated with YouTube, TikTok, Facebook, Pinterest or any other platform.
          </p>
          <p className="mt-2">
            Powered by{" "}
            <a className="text-foreground underline-offset-4 hover:underline" href="https://github.com/yt-dlp/yt-dlp" target="_blank" rel="noreferrer">
              yt-dlp
            </a>{" "}
            and{" "}
            <a className="text-foreground underline-offset-4 hover:underline" href="https://ffmpeg.org" target="_blank" rel="noreferrer">
              FFmpeg
            </a>
            , free and open-source software.
          </p>
        </div>
      </div>
    </footer>
  );
}
