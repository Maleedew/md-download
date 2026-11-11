/**
 * Pure helpers (no I/O) – turn yt-dlp's raw JSON into the small structure the UI needs,
 * and build the yt-dlp arguments for a chosen MP4 / MP3 quality.
 */
import { config } from "./config.js";

export type Kind = "mp4" | "mp3";

export interface VideoQuality {
  /** Shorter side of the frame, e.g. 1080. 0 = "best available" (resolution unknown). */
  res: number;
  label: string;
  approxBytes?: number;
}
export interface AudioQuality {
  kbps: number;
  label: string;
  approxBytes?: number;
}
export interface VideoInfo {
  id: string;
  title: string;
  uploader?: string;
  duration?: number;
  thumbnail?: string;
  platform: string;
  webpageUrl: string;
  hasVideo: boolean;
  hasAudio: boolean;
  video: VideoQuality[];
  audio: AudioQuality[];
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type RawFormat = Record<string, any>;

export const MP3_BITRATES = [320, 256, 192, 128, 64] as const;

const PLATFORM_NAMES: Record<string, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  facebook: "Facebook",
  instagram: "Instagram",
  twitter: "X (Twitter)",
  pinterest: "Pinterest",
  reddit: "Reddit",
  vimeo: "Vimeo",
  dailymotion: "Dailymotion",
  twitch: "Twitch",
  soundcloud: "SoundCloud",
  bilibili: "Bilibili",
  snapchat: "Snapchat",
  linkedin: "LinkedIn",
  threads: "Threads",
  likee: "Likee",
  vk: "VK",
};

export function platformName(raw: Record<string, any>): string {
  const key = String(raw.extractor_key ?? raw.extractor ?? "").toLowerCase();
  const base = key.split(":")[0].replace(/(user|playlist|tab|clip|short|shorts|story|reel|post)s?$/i, "");
  for (const [k, v] of Object.entries(PLATFORM_NAMES)) {
    if (base.startsWith(k)) return v;
  }
  const name = String(raw.extractor_key ?? raw.extractor ?? "Web");
  return name.charAt(0).toUpperCase() + name.slice(1);
}

const hasVideoCodec = (f: RawFormat) => f.vcodec !== "none" && !isStoryboard(f);
const hasAudioCodec = (f: RawFormat) => f.acodec !== "none" && !isStoryboard(f);
const isStoryboard = (f: RawFormat) =>
  f.ext === "mhtml" || /storyboard/i.test(String(f.format_note ?? "")) || f.vcodec === "images";

function resolutionOf(f: RawFormat): number {
  const w = Number(f.width);
  const h = Number(f.height);
  if (w > 0 && h > 0) return Math.min(w, h);
  if (h > 0) return h;
  const m = /(\d{3,4})p/i.exec(String(f.format_note ?? f.format ?? ""));
  return m ? Number(m[1]) : 0;
}

function sizeOf(f: RawFormat, duration?: number): number | undefined {
  const s = Number(f.filesize ?? f.filesize_approx);
  if (s > 0) return s;
  const tbr = Number(f.tbr);
  if (tbr > 0 && duration && duration > 0) return Math.round(((tbr * 1000) / 8) * duration);
  return undefined;
}

export function normalizeInfo(raw: Record<string, any>): VideoInfo {
  const formats: RawFormat[] = Array.isArray(raw.formats) ? raw.formats : [];
  const duration = Number(raw.duration) > 0 ? Number(raw.duration) : undefined;

  // Some extractors expose a single URL and no "formats" array.
  const effective: RawFormat[] = formats.length ? formats : raw.url ? [raw] : [];

  const videoFormats = effective.filter(hasVideoCodec).filter((f) => f.vcodec != null || f.acodec == null || f.height);
  const audioFormats = effective.filter(hasAudioCodec);
  const audioOnly = effective.filter((f) => f.vcodec === "none" && hasAudioCodec(f));

  const bestAudioSize = Math.max(0, ...audioOnly.map((f) => sizeOf(f, duration) ?? 0)) || undefined;

  // Group by resolution.
  const byRes = new Map<number, RawFormat[]>();
  for (const f of videoFormats) {
    const res = resolutionOf(f);
    byRes.set(res, [...(byRes.get(res) ?? []), f]);
  }

  let video: VideoQuality[] = [];
  const known = [...byRes.keys()].filter((r) => r > 0);
  if (known.length) {
    video = known
      .sort((a, b) => b - a)
      .map((res) => {
        const group = byRes.get(res)!;
        const sized = group
          .map((f) => ({ f, s: sizeOf(f, duration) }))
          .filter((x): x is { f: RawFormat; s: number } => x.s != null)
          .sort((a, b) => b.s - a.s)[0];
        let approxBytes: number | undefined;
        if (sized) {
          approxBytes = sized.s + (sized.f.acodec === "none" ? (bestAudioSize ?? 0) : 0);
        }
        return {
          res,
          label: `${res}p`,
          approxBytes,
        };
      });
  } else if (videoFormats.length) {
    video = [{ res: 0, label: "Best available" }];
  }

  const hasVideo = video.length > 0;
  const hasAudio = audioFormats.length > 0 || (!hasVideo && effective.length > 0);

  const audio: AudioQuality[] = hasAudio
    ? MP3_BITRATES.map((kbps) => ({
        kbps,
        label: kbps === 320 ? "320 kbps · Best" : kbps === 128 ? "128 kbps · Standard" : `${kbps} kbps`,
        approxBytes: duration ? Math.round(((kbps * 1000) / 8) * duration) : undefined,
      }))
    : [];

  const thumb =
    typeof raw.thumbnail === "string"
      ? raw.thumbnail
      : Array.isArray(raw.thumbnails)
        ? [...raw.thumbnails].reverse().find((t: any) => typeof t?.url === "string" && /^https?:/.test(t.url))?.url
        : undefined;

  return {
    id: String(raw.id ?? ""),
    title: String(raw.title ?? raw.fulltitle ?? "Untitled video").slice(0, 300),
    uploader: raw.uploader ?? raw.channel ?? raw.creator ?? undefined,
    duration,
    thumbnail: thumb,
    platform: platformName(raw),
    webpageUrl: String(raw.webpage_url ?? raw.original_url ?? ""),
    hasVideo,
    hasAudio,
    video,
    audio,
  };
}

/* ───────────────────────────── yt-dlp argument builders ───────────────────────────── */

/** Arguments shared by every yt-dlp call. */
export function baseArgs(): string[] {
  const args = [
    "--ignore-config",
    "--no-colors",
    "--no-playlist",
    "--playlist-items", "1",
    "--socket-timeout", "20",
    "--retries", "3",
    "--fragment-retries", "3",
    "--js-runtimes", "node",
  ];
  if (!config.allowGeneric) args.push("--use-extractors", "default,-generic");
  if (config.cookiesFile) args.push("--cookies", config.cookiesFile);
  if (config.proxy) args.push("--proxy", config.proxy);
  return args;
}

export const PROGRESS_PREFIX = "MDDL|";
export const FILE_PREFIX = "MDFILE|";

export interface DownloadSpec {
  url: string;
  kind: Kind;
  /** mp4: shorter-side resolution (0 = best). mp3: bitrate in kbps. */
  quality: number;
  outDir: string;
}

export function buildDownloadArgs(spec: DownloadSpec): string[] {
  const args = [
    ...baseArgs(),
    "--newline",
    "--no-mtime",
    "--windows-filenames",
    "--concurrent-fragments", "4",
    "--max-filesize", `${config.maxFileSizeMb}M`,
    "-o", `${spec.outDir}/%(title).120B.%(ext)s`,
    "--progress-template",
    `download:${PROGRESS_PREFIX}%(progress.downloaded_bytes)s|%(progress.total_bytes)s|%(progress.total_bytes_estimate)s|%(progress.speed)s|%(progress.eta)s|%(progress.filename)s`,
  ];

  if (spec.kind === "mp4") {
    // Pick the best stream whose shorter side is <= the chosen resolution, prefer H.264 + AAC so
    // the file plays everywhere (QuickTime, Windows, phones), then merge/remux into an .mp4.
    const sort = [
      spec.quality > 0 ? `res:${spec.quality}` : "res",
      "vcodec:h264",
      "fps",
      "acodec:aac",
      "ext:mp4:m4a",
    ].join(",");
    args.push("-f", "bv*+ba/b", "-S", sort, "--merge-output-format", "mp4", "--remux-video", "mp4");
  } else {
    const kbps = Math.min(320, Math.max(32, Math.round(spec.quality) || 192));
    args.push(
      "-f", "ba/b",
      "-x",
      "--audio-format", "mp3",
      "--audio-quality", `${kbps}K`,
      "--embed-metadata",
    );
  }

  args.push("--", spec.url);
  return args;
}

export function buildInfoArgs(url: string): string[] {
  return [...baseArgs(), "-J", "--no-warnings", "--", url];
}

/* ───────────────────────────── error translation ───────────────────────────── */

const ERROR_RULES: [RegExp, string][] = [
  [/unsupported url/i, "That link isn't supported. Paste a direct link to a single video."],
  [/sign in to confirm you.?re not a bot|confirm you.?re not a bot|http error 429|too many requests/i,
    "The platform is temporarily limiting this server. Please try again in a few minutes."],
  [/sign in to confirm your age|age.restricted|inappropriate for some users/i,
    "This video is age-restricted and can't be downloaded without signing in."],
  [/private video|this video is private|login required|requires? (a )?login|please log in|need to log in|sign in/i,
    "This video is private or requires a login, so it can't be downloaded."],
  [/members.only|join this channel|premium|subscribers?.only/i,
    "This video is only for members or subscribers."],
  [/requested format is not available|requested format not available/i,
    "That quality isn't available for this video. Please pick another one."],
  [/video unavailable|not available|has been removed|no longer available|does not exist|deleted|404/i,
    "This video isn't available (removed, private, or blocked in this region)."],
  [/geo.?restrict|not available in your country|blocked it in your country/i,
    "This video is blocked in the server's region."],
  [/live event will begin|is live|this live event|premieres in/i,
    "Live streams and upcoming premieres can't be downloaded yet."],
  [/drm|protected by/i, "This video is DRM-protected and can't be downloaded."],
  [/larger than max-filesize|file is larger/i, `That file is too large (limit ${config.maxFileSizeMb} MB).`],
  [/ffmpeg|ffprobe/i, "Converting the file failed on the server. Please try a different quality."],
  [/timed out|timeout|connection (reset|refused)|temporary failure|network is unreachable|unable to download/i,
    "Couldn't reach the platform. Please try again."],
];

export function friendlyError(stderr: string): string {
  const line =
    stderr
      .split("\n")
      .reverse()
      .find((l) => /^ERROR:/i.test(l.trim())) ?? stderr;
  for (const [re, msg] of ERROR_RULES) if (re.test(line)) return msg;
  return "Sorry, this video couldn't be processed. Check the link and try again.";
}
