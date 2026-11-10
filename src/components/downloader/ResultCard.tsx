import { useState } from "react";
import { Clock, Download, Film, ImageOff, Music, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioPill } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Kind, VideoInfo } from "@/lib/api";
import { formatBytes, formatDuration } from "@/lib/utils";

const RES_NAMES: Record<number, string> = {
  4320: "8K",
  2160: "4K Ultra HD",
  1440: "2K QHD",
  1080: "Full HD",
  720: "HD",
  480: "Standard",
  360: "Low",
  240: "Very low",
  144: "Tiny",
};

interface Props {
  info: VideoInfo;
  kind: Kind;
  videoRes: number;
  audioKbps: number;
  onKind: (k: Kind) => void;
  onVideoRes: (r: number) => void;
  onAudioKbps: (k: number) => void;
  onDownload: () => void;
}

export function ResultCard({ info, kind, videoRes, audioKbps, onKind, onVideoRes, onAudioKbps, onDownload }: Props) {
  const [thumbFailed, setThumbFailed] = useState(false);
  const chosen =
    kind === "mp4"
      ? info.video.find((v) => v.res === videoRes)?.label
      : info.audio.find((a) => a.kbps === audioKbps)?.label.split(" · ")[0];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:gap-5">
        <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-2xl border bg-secondary sm:w-56">
          {info.thumbnail && !thumbFailed ? (
            <img
              src={info.thumbnail}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setThumbFailed(true)}
              className="size-full object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground">
              <ImageOff className="size-8" />
            </div>
          )}
          {info.duration ? (
            <span className="absolute right-2 bottom-2 rounded-full bg-ink/80 px-2.5 py-0.5 text-xs font-semibold backdrop-blur">
              {formatDuration(info.duration)}
            </span>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-col justify-center gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{info.platform}</Badge>
            {info.duration ? (
              <Badge variant="outline">
                <Clock />
                {formatDuration(info.duration)}
              </Badge>
            ) : null}
          </div>
          <h3 className="line-clamp-2 text-lg leading-snug font-semibold sm:text-xl">{info.title}</h3>
          {info.uploader ? (
            <p className="flex items-center gap-1.5 truncate text-sm text-muted-foreground">
              <User className="size-4 shrink-0" />
              {info.uploader}
            </p>
          ) : null}
        </div>
      </div>

      <Tabs value={kind} onValueChange={(v) => onKind(v as Kind)}>
        <TabsList>
          <TabsTrigger value="mp4" disabled={!info.hasVideo}>
            <Film /> MP4 Video
          </TabsTrigger>
          <TabsTrigger value="mp3" disabled={!info.hasAudio}>
            <Music /> MP3 Audio
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mp4">
          <RadioGroup
            aria-label="Video quality"
            value={String(videoRes)}
            onValueChange={(v) => onVideoRes(Number(v))}
            className="grid-cols-2 sm:grid-cols-3"
          >
            {info.video.map((q) => (
              <RadioPill key={q.res} value={String(q.res)}>
                <span className="text-base font-semibold">{q.label}</span>
                <span className="text-xs text-muted-foreground">
                  {[RES_NAMES[q.res], q.approxBytes ? `~${formatBytes(q.approxBytes)}` : ""].filter(Boolean).join(" · ")}
                </span>
              </RadioPill>
            ))}
          </RadioGroup>
        </TabsContent>

        <TabsContent value="mp3">
          <RadioGroup
            aria-label="Audio quality"
            value={String(audioKbps)}
            onValueChange={(v) => onAudioKbps(Number(v))}
            className="grid-cols-2 sm:grid-cols-3"
          >
            {info.audio.map((a) => {
              const [kbps, note] = a.label.split(" · ");
              return (
                <RadioPill key={a.kbps} value={String(a.kbps)}>
                  <span className="text-base font-semibold">{kbps}</span>
                  <span className="text-xs text-muted-foreground">
                    {[note, a.approxBytes ? `~${formatBytes(a.approxBytes)}` : ""].filter(Boolean).join(" · ") || "MP3"}
                  </span>
                </RadioPill>
              );
            })}
          </RadioGroup>
        </TabsContent>
      </Tabs>

      <div className="flex flex-col gap-3">
        <Button size="lg" className="btn-shine w-full" onClick={onDownload}>
          <Download />
          Download {kind.toUpperCase()}
          {chosen ? ` · ${chosen}` : ""}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Files are removed from our server shortly after your download is ready.
        </p>
      </div>
    </div>
  );
}
