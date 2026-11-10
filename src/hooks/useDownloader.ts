import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, type JobState, type Kind, type VideoInfo } from "@/lib/api";

export type Phase = "idle" | "analyzing" | "ready" | "downloading" | "done" | "error";

export interface DownloaderState {
  phase: Phase;
  url: string;
  info: VideoInfo | null;
  kind: Kind;
  /** Chosen MP4 resolution (shorter side, 0 = best). */
  videoRes: number;
  /** Chosen MP3 bitrate in kbps. */
  audioKbps: number;
  jobId: string | null;
  job: JobState | null;
  error: string | null;
  errorFrom: "analyze" | "download" | null;
}

const initial: DownloaderState = {
  phase: "idle",
  url: "",
  info: null,
  kind: "mp4",
  videoRes: 0,
  audioKbps: 192,
  jobId: null,
  job: null,
  error: null,
  errorFrom: null,
};

const POLL_MS = 700;
const MAX_POLL_FAILURES = 6;

export function useDownloader() {
  const [s, setS] = useState<DownloaderState>(initial);
  const analyzeSeq = useRef(0);

  const analyze = useCallback(async (rawUrl: string) => {
    const url = rawUrl.trim();
    if (!url) return;
    const seq = ++analyzeSeq.current;
    setS((p) => ({ ...initial, url, phase: "analyzing", audioKbps: p.audioKbps }));
    try {
      const info = await api.info(url);
      if (seq !== analyzeSeq.current) return;
      const preferred = info.video.find((v) => v.res > 0 && v.res <= 1080) ?? info.video[0];
      const kbps = info.audio.find((a) => a.kbps === 192)?.kbps ?? info.audio[0]?.kbps ?? 192;
      setS((p) => ({
        ...p,
        phase: "ready",
        info,
        kind: info.hasVideo ? "mp4" : "mp3",
        videoRes: preferred?.res ?? 0,
        audioKbps: kbps,
      }));
    } catch (e) {
      if (seq !== analyzeSeq.current) return;
      setS((p) => ({
        ...p,
        phase: "error",
        error: e instanceof ApiError ? e.message : "Something went wrong. Please try again.",
        errorFrom: "analyze",
      }));
    }
  }, []);

  const setKind = useCallback((kind: Kind) => setS((p) => ({ ...p, kind })), []);
  const setVideoRes = useCallback((videoRes: number) => setS((p) => ({ ...p, videoRes })), []);
  const setAudioKbps = useCallback((audioKbps: number) => setS((p) => ({ ...p, audioKbps })), []);

  const start = useCallback(async () => {
    const { url, kind, videoRes, audioKbps } = s;
    setS((p) => ({ ...p, phase: "downloading", job: null, jobId: null, error: null }));
    try {
      const { id } = await api.startJob(url, kind, kind === "mp4" ? videoRes : audioKbps);
      setS((p) => ({ ...p, jobId: id }));
    } catch (e) {
      setS((p) => ({
        ...p,
        phase: "error",
        error: e instanceof ApiError ? e.message : "Couldn't start the download.",
        errorFrom: "download",
      }));
    }
  }, [s]);

  // Poll the job until it finishes.
  const { phase, jobId } = s;
  useEffect(() => {
    if (phase !== "downloading" || !jobId) return;
    let stopped = false;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      try {
        const job = await api.job(jobId);
        if (stopped) return;
        failures = 0;
        if (job.status === "done") {
          setS((p) => ({ ...p, job, phase: "done" }));
        } else if (job.status === "error") {
          setS((p) => ({ ...p, job, phase: "error", error: job.error ?? "The download failed.", errorFrom: "download" }));
        } else {
          setS((p) => ({ ...p, job }));
          timer = setTimeout(tick, POLL_MS);
        }
      } catch (e) {
        if (stopped) return;
        const gone = e instanceof ApiError && e.status === 404;
        if (gone || ++failures >= MAX_POLL_FAILURES) {
          setS((p) => ({
            ...p,
            phase: "error",
            error: e instanceof ApiError ? e.message : "Lost connection to the server.",
            errorFrom: "download",
          }));
        } else {
          timer = setTimeout(tick, POLL_MS * 2);
        }
      }
    };
    tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [phase, jobId]);

  const cancel = useCallback(() => {
    if (s.jobId) api.cancel(s.jobId).catch(() => {});
    setS((p) => ({ ...p, phase: "ready", job: null, jobId: null }));
  }, [s.jobId]);

  /** Back to the quality picker for the same video. */
  const another = useCallback(() => setS((p) => ({ ...p, phase: "ready", job: null, jobId: null, error: null })), []);
  /** Back to an empty input. */
  const reset = useCallback(() => {
    analyzeSeq.current++;
    setS({ ...initial });
  }, []);
  /** After an error: return to wherever the user can try again. */
  const recover = useCallback(
    () =>
      setS((p) =>
        p.errorFrom === "download" && p.info
          ? { ...p, phase: "ready", job: null, jobId: null, error: null }
          : { ...initial, url: p.url },
      ),
    [],
  );

  return { state: s, analyze, setKind, setVideoRes, setAudioKbps, start, cancel, another, reset, recover };
}
