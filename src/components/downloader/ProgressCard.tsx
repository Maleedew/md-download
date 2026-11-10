import { X } from "lucide-react";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { JobState, Kind, VideoInfo } from "@/lib/api";
import { formatBytes, formatEta } from "@/lib/utils";

function stageLabel(job: JobState | null, kind: Kind): string {
  if (!job || job.stage === "queued") {
    return job?.queuePosition ? `Waiting in line — you're #${job.queuePosition}` : "Starting…";
  }
  if (job.stage === "processing") return kind === "mp3" ? "Converting to MP3…" : "Merging video & audio…";
  return "Downloading from the source…";
}

export function ProgressCard({
  info,
  job,
  kind,
  onCancel,
}: {
  info: VideoInfo;
  job: JobState | null;
  kind: Kind;
  onCancel: () => void;
}) {
  const pct = job?.progress ?? 0;
  const indeterminate = !job || job.stage === "queued" || (pct === 0 && job.stage === "downloading");
  const meta = [job?.speed ? `${formatBytes(job.speed)}/s` : "", formatEta(job?.eta)].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-col gap-6" role="status" aria-live="polite">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2.5 text-sm font-medium text-primary">
            <span className="eq" aria-hidden>
              <i />
              <i />
              <i />
              <i />
            </span>
            {stageLabel(job, kind)}
          </p>
          <p className="mt-1.5 line-clamp-1 text-base font-semibold">{info.title}</p>
        </div>
        <AnimatedNumber value={pct} className="font-display text-5xl leading-none font-bold tabular-nums sm:text-6xl" />
      </div>

      <div className="flex flex-col gap-3">
        <Progress value={pct} indeterminate={indeterminate} aria-label="Download progress" />
        <div className="flex min-h-5 items-center justify-between text-xs text-muted-foreground">
          <span>{meta || (kind === "mp3" ? "MP3" : "MP4")}</span>
          <span>{kind.toUpperCase()}</span>
        </div>
      </div>

      <Button variant="outline" onClick={onCancel} className="self-start">
        <X />
        Cancel
      </Button>
    </div>
  );
}
