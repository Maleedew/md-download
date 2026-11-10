import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useDownloader } from "@/hooks/useDownloader";
import { prefersReducedMotion } from "@/lib/utils";
import { Enter } from "@/components/Enter";
import { DoneCard } from "@/components/downloader/DoneCard";
import { ErrorCard } from "@/components/downloader/ErrorCard";
import { ProgressCard } from "@/components/downloader/ProgressCard";
import { ResultCard } from "@/components/downloader/ResultCard";
import { ServerBanner, useServerStatus } from "@/components/downloader/ServerStatus";
import { UrlForm } from "@/components/downloader/UrlForm";

function Skeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-5 sm:flex-row" aria-hidden>
      <div className="aspect-video w-full rounded-2xl bg-secondary sm:w-56" />
      <div className="flex flex-1 flex-col justify-center gap-3">
        <div className="h-5 w-24 rounded-full bg-secondary" />
        <div className="h-6 w-4/5 rounded-full bg-secondary" />
        <div className="h-4 w-2/5 rounded-full bg-secondary" />
      </div>
    </div>
  );
}

export function Downloader() {
  const d = useDownloader();
  const { status, recheck } = useServerStatus();
  const [input, setInput] = useState("");
  const s = d.state;

  // Bring the card into view whenever its content changes (result → progress → done), so the
  // user never has to hunt for it after the page re-flows.
  const wrapRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (s.phase === "ready" || s.phase === "downloading" || s.phase === "done" || s.phase === "error") {
      wrapRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
    }
  }, [s.phase]);

  const locked = s.phase === "downloading" || s.phase === "done";
  const reset = () => {
    setInput("");
    d.reset();
  };

  return (
    <div id="downloader" ref={wrapRef} className="mx-auto w-full max-w-3xl scroll-mt-4 text-left">
      <ServerBanner status={status} onChanged={recheck} />

      <Card className="glow-border rounded-[2rem] bg-card/80 shadow-[0_30px_120px_-40px_var(--electric)]">
        <CardContent className="flex flex-col gap-6">
          <UrlForm
            value={input}
            onChange={setInput}
            onSubmit={(v) => void d.analyze(v)}
            busy={s.phase === "analyzing"}
            disabled={locked}
          />

          {s.phase === "idle" && (
            <p className="text-center text-[13px] text-muted-foreground">
              YouTube · Shorts · TikTok · Facebook · Pinterest · Instagram · X · Reddit · and 1000+ more
            </p>
          )}

          {s.phase === "analyzing" && (
            <Enter key="analyzing">
              <Skeleton />
            </Enter>
          )}

          {s.phase === "ready" && s.info && (
            <Enter key={`ready-${s.info.id}`}>
              <ResultCard
                info={s.info}
                kind={s.kind}
                videoRes={s.videoRes}
                audioKbps={s.audioKbps}
                onKind={d.setKind}
                onVideoRes={d.setVideoRes}
                onAudioKbps={d.setAudioKbps}
                onDownload={() => void d.start()}
              />
            </Enter>
          )}

          {s.phase === "downloading" && s.info && (
            <Enter key="downloading">
              <ProgressCard info={s.info} job={s.job} kind={s.kind} onCancel={d.cancel} />
            </Enter>
          )}

          {s.phase === "done" && s.job && (
            <Enter key="done">
              <DoneCard job={s.job} onAnother={d.another} onReset={reset} />
            </Enter>
          )}

          {s.phase === "error" && (
            <Enter key="error">
              <ErrorCard message={s.error ?? "Something went wrong."} onRetry={d.recover} />
            </Enter>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
