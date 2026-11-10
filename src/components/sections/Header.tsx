import { ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Logo({ className }: { className?: string }) {
  return (
    <a href="#top" className={`flex items-center gap-2.5 ${className ?? ""}`} aria-label="md download — home">
      <span className="flex size-9 items-center justify-center rounded-xl border-2 border-primary bg-ink">
        <ArrowDown className="size-5 text-foreground" strokeWidth={3} />
      </span>
      <span className="font-display text-lg font-bold tracking-tight">
        md <span className="text-primary">download</span>
      </span>
    </a>
  );
}

const LINKS = [
  ["Platforms", "#platforms"],
  ["Features", "#features"],
  ["How it works", "#how"],
  ["FAQ", "#faq"],
] as const;

export function Header() {
  return (
    <header className="sticky top-0 z-40 px-4 pt-4">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between rounded-full border bg-background/70 px-5 backdrop-blur-xl">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {LINKS.map(([label, href]) => (
            <a
              key={href}
              href={href}
              className="rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              {label}
            </a>
          ))}
        </nav>
        <Button asChild size="sm" className="btn-shine">
          <a href="#downloader">Start downloading</a>
        </Button>
      </div>
    </header>
  );
}
