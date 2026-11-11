import { spawn, execFile, type ChildProcess } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";
import { UserError } from "./errors.js";
import {
  buildDownloadArgs,
  buildInfoArgs,
  friendlyError,
  normalizeInfo,
  PROGRESS_PREFIX,
  type DownloadSpec,
  type VideoInfo,
} from "./format.js";

const execFileP = promisify(execFile);
const MAX_INFO_BYTES = 40 * 1024 * 1024;

/** Kill a child *and* everything it spawned (yt-dlp → ffmpeg). */
export function killTree(proc: ChildProcess) {
  if (!proc.pid) return;
  try {
    process.kill(-proc.pid, "SIGKILL");
  } catch {
    try {
      proc.kill("SIGKILL");
    } catch {
      /* already gone */
    }
  }
}

/* ───────────────────────────── info ───────────────────────────── */

export function fetchInfo(url: string): Promise<VideoInfo> {
  return new Promise((resolve, reject) => {
    const proc = spawn(config.ytdlpBin, buildInfoArgs(url), {
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
    });
    const out: Buffer[] = [];
    let outSize = 0;
    let err = "";
    let settled = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };
    const timer = setTimeout(() => {
      killTree(proc);
      finish(() => reject(new UserError("The platform took too long to respond. Please try again.", 504)));
    }, 60_000);

    proc.stdout!.on("data", (chunk: Buffer) => {
      outSize += chunk.length;
      if (outSize > MAX_INFO_BYTES) {
        killTree(proc);
        finish(() => reject(new UserError("That link returned too much data.", 422)));
        return;
      }
      out.push(chunk);
    });
    proc.stderr!.on("data", (chunk: Buffer) => {
      err = (err + chunk.toString()).slice(-8000);
    });
    proc.on("error", (e) => {
      console.error("[yt-dlp] failed to start:", e.message);
      finish(() => reject(new UserError("The download engine isn't available on the server.", 503)));
    });
    proc.on("close", (code) => {
      finish(() => {
        if (code !== 0) {
          console.error("[yt-dlp info] exit", code, err.trim().split("\n").slice(-3).join(" | "));
          return reject(new UserError(friendlyError(err), 422));
        }
        try {
          const raw = JSON.parse(Buffer.concat(out).toString("utf8"));
          const entry = raw?._type === "playlist" ? raw.entries?.find(Boolean) : raw;
          if (!entry) throw new Error("no entry");
          const info = normalizeInfo(entry);
          if (!info.webpageUrl) info.webpageUrl = url;
          if (!info.hasVideo && !info.hasAudio) {
            return reject(new UserError("No downloadable video or audio was found at that link.", 422));
          }
          if (config.maxDurationMin > 0 && info.duration && info.duration > config.maxDurationMin * 60) {
            return reject(
              new UserError(`Videos longer than ${config.maxDurationMin} minutes aren't supported on this server.`, 422),
            );
          }
          resolve(info);
        } catch (e) {
          console.error("[yt-dlp info] parse error", (e as Error).message);
          reject(new UserError("Couldn't read the video details. Please try again.", 502));
        }
      });
    });
  });
}

/* ───────────────────────────── download ───────────────────────────── */

export interface ProgressUpdate {
  stage: "downloading" | "processing";
  /** 0-100, overall (all streams + conversion). */
  progress: number;
  speed?: number | null;
  eta?: number | null;
}
export interface DownloadResult {
  filePath: string;
  fileName: string;
  size: number;
}

const num = (v: string | undefined): number | null => {
  if (v == null || v === "NA" || v === "None" || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Maps one stream's fraction (0-1) to the job's overall 0-100 progress. */
export function overallProgress(kind: DownloadSpec["kind"], streams: number, streamIdx: number, frac: number): number {
  const f = Math.min(1, Math.max(0, frac));
  if (kind === "mp3") return f * 85;
  if (streams >= 2) return streamIdx <= 0 ? f * 84 : 84 + f * 10;
  return f * 94;
}

export function parseProgressLine(line: string) {
  const [dl, total, est, speed, eta, ...rest] = line.slice(PROGRESS_PREFIX.length).split("|");
  const d = num(dl);
  const t = num(total) ?? num(est);
  return {
    frac: d != null && t ? d / t : 0,
    speed: num(speed),
    eta: num(eta),
    filename: rest.join("|"),
  };
}

const TEMP_FILE = /\.(part|ytdl|temp|tmp|frag\d*)$|\.f\d+\.[a-z0-9]+$/i;

export async function findOutput(dir: string, kind: DownloadSpec["kind"]): Promise<DownloadResult | null> {
  const names = (await fs.readdir(dir)).filter((n) => !TEMP_FILE.test(n));
  const wanted = names.filter((n) => n.toLowerCase().endsWith(`.${kind}`));
  const pick = wanted[0] ?? names[0];
  if (!pick) return null;
  const filePath = path.join(dir, pick);
  const stat = await fs.stat(filePath);
  return { filePath, fileName: pick, size: stat.size };
}

export function runDownload(
  spec: DownloadSpec,
  onProgress: (u: ProgressUpdate) => void,
  signal: AbortSignal,
): Promise<DownloadResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn(config.ytdlpBin, buildDownloadArgs(spec), {
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
    });

    let streams = 1;
    let streamIdx = -1;
    let lastFile = "";
    let log = "";
    let buffer = "";
    let aborted = false;

    const onAbort = () => {
      aborted = true;
      killTree(proc);
    };
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });

    const handleLine = (line: string) => {
      if (line.startsWith(PROGRESS_PREFIX)) {
        const p = parseProgressLine(line);
        if (p.filename !== lastFile) {
          lastFile = p.filename;
          streamIdx++;
        }
        onProgress({
          stage: "downloading",
          progress: overallProgress(spec.kind, streams, streamIdx, p.frac),
          speed: p.speed,
          eta: p.eta,
        });
        return;
      }
      log = (log + line + "\n").slice(-10_000);
      const m = /Downloading (\d+) format\(s\): (.+)$/.exec(line);
      if (m) {
        streams = m[2].split("+").length;
        return;
      }
      if (/^\[(Merger|ExtractAudio|VideoRemuxer|Metadata|Fixup\w*|EmbedThumbnail|MoveFiles)\]/.test(line)) {
        onProgress({ stage: "processing", progress: spec.kind === "mp3" ? 90 : 96, speed: null, eta: null });
      }
    };

    proc.stdout!.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        handleLine(buffer.slice(0, nl).replace(/\r$/, ""));
        buffer = buffer.slice(nl + 1);
      }
    });
    proc.stderr!.on("data", (chunk: Buffer) => {
      log = (log + chunk.toString()).slice(-10_000);
    });

    proc.on("error", (e) => {
      console.error("[yt-dlp] failed to start:", e.message);
      reject(new UserError("The download engine isn't available on the server.", 503));
    });
    proc.on("close", async (code) => {
      signal.removeEventListener("abort", onAbort);
      if (aborted) return reject(new UserError("Download canceled.", 499));
      if (code !== 0) {
        console.error("[yt-dlp dl] exit", code, log.trim().split("\n").slice(-4).join(" | "));
        return reject(new UserError(friendlyError(log), 422));
      }
      try {
        const out = await findOutput(spec.outDir, spec.kind);
        if (!out) {
          console.error("[yt-dlp dl] no output file.", log.trim().split("\n").slice(-4).join(" | "));
          return reject(new UserError(friendlyError(log), 422));
        }
        resolve(out);
      } catch (e) {
        reject(e);
      }
    });
  });
}

/* ───────────────────────────── health ───────────────────────────── */

export async function ytdlpVersion(): Promise<string | null> {
  try {
    const { stdout } = await execFileP(config.ytdlpBin, ["--version"], { timeout: 10_000 });
    return stdout.trim();
  } catch {
    return null;
  }
}
export async function ffmpegAvailable(): Promise<boolean> {
  try {
    await execFileP(config.ffmpegBin, ["-version"], { timeout: 10_000 });
    return true;
  } catch {
    return false;
  }
}
