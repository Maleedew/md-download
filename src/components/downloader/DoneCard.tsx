import { useEffect, useRef } from "react";
import { animate } from "animejs";
import { Check, Download, RotateCcw, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, type JobState } from "@/lib/api";
import { formatBytes, prefersReducedMotion } from "@/lib/utils";

export function DoneCard({
  job,
  onAnother,
  onReset,
}: {
  job: JobState;
  onAnother: () => void;
  onReset: () => void;
}) {
  const badge = useRef<HTMLDivElement>(null);
  const href = job.blobUrl ?? api.fileUrl(job.id);

  // Pop the check mark in.
  useEffect(() => {
    const el = badge.current;
    if (!el || prefersReducedMotion()) return;
    const a = animate(el, { scale: [0.3, 1], opacity: [0, 1], duration: 900, ease: "outElastic(1, .6)" });
    return () => {
      a.pause();
    };
  }, []);

  // Start the browser's download automatically, once. The button below is the fallback.
  const started = useRef<string | null>(null);
  useEffect(() => {
    if (started.current === job.id) return;
    started.current = job.id;
    const a = document.createElement("a");
    a.href = href;
    a.download = job.fileName ?? "";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [job.id, job.fileName, href]);

  return (
    <div className="flex flex-col items-center gap-6 py-2 text-center">
      <div ref={badge} className="flex size-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_0_50px_-8px_var(--electric)]">
        <Check className="size-10" strokeWidth={3} />
      </div>
      <div className="min-w-0 max-w-full">
        <h3 className="text-2xl font-semibold">Your file is ready</h3>
        <p className="mt-2 truncate text-sm text-muted-foreground" title={job.fileName}>
          {job.fileName}
          {job.size ? ` · ${formatBytes(job.size)}` : ""}
        </p>
      </div>
      <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
        <Button asChild size="lg" className="btn-shine">
          <a href={href} download={job.fileName ?? ""}>
            <Download />
            Save file
          </a>
        </Button>
        <Button variant="outline" size="lg" onClick={onAnother}>
          <RotateCcw />
          Another quality
        </Button>
        <Button variant="ghost" size="lg" onClick={onReset}>
          <Plus />
          New link
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Download didn't start? Tap “Save file”.</p>
    </div>
  );
}
