import os from "node:os";
import path from "node:path";

const num = (v: string | undefined, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : d;
};
const flag = (v: string | undefined) => v === "1" || v === "true";

export const config = {
  port: num(process.env.PORT, 8787),

  /** Comma separated list of origins allowed to call the API (your Netlify URL). "*" = any. */
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? "*")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  /** Where temporary downloads live. Files are deleted automatically. */
  tmpDir: process.env.TMP_DIR ?? path.join(os.tmpdir(), "md-download"),

  ytdlpBin: process.env.YTDLP_BIN ?? "yt-dlp",
  ffmpegBin: process.env.FFMPEG_BIN ?? "ffmpeg",

  /** Optional Netscape cookies.txt (helps with age-gated / "confirm you're not a bot" videos). */
  cookiesFile: process.env.COOKIES_FILE || undefined,
  /** Optional proxy for yt-dlp, e.g. http://user:pass@host:port */
  proxy: process.env.YTDLP_PROXY || undefined,

  maxConcurrentJobs: num(process.env.MAX_CONCURRENT_JOBS, 2),
  maxQueuedJobs: num(process.env.MAX_QUEUED_JOBS, 20),
  /** Minutes a finished file is kept before deletion. */
  fileTtlMs: num(process.env.FILE_TTL_MINUTES, 15) * 60_000,
  /** Hard stop for a single download job. */
  jobTimeoutMs: num(process.env.JOB_TIMEOUT_MINUTES, 20) * 60_000,
  /** Refuse files bigger than this (MB). */
  maxFileSizeMb: num(process.env.MAX_FILE_SIZE_MB, 1024),
  /** Refuse videos longer than this (minutes) – protects a small server. 0 = unlimited. */
  maxDurationMin: Number(process.env.MAX_DURATION_MIN ?? 180),

  /** Rate limits (per IP). */
  infoPerMinute: num(process.env.INFO_PER_MINUTE, 20),
  jobsPerMinute: num(process.env.JOBS_PER_MINUTE, 6),

  /** Behind a reverse proxy (Render, Fly, Railway, Nginx…) so req.ip is the real client. */
  trustProxy: process.env.TRUST_PROXY ?? "1",

  /**
   * Safety switches. By default private network addresses are blocked (SSRF protection)
   * and yt-dlp's "generic" extractor (arbitrary direct URLs) is disabled.
   * Only enable for local testing.
   */
  allowPrivateHosts: flag(process.env.DEV_ALLOW_PRIVATE_HOSTS),
  allowGeneric: flag(process.env.ALLOW_GENERIC),
};
