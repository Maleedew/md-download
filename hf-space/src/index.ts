import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import { rateLimit } from "express-rate-limit";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { config } from "./config.js";
import { UserError } from "./errors.js";
import { MP3_BITRATES, type Kind, type VideoInfo } from "./format.js";
import { cancelJob, createJob, getJob, initJobs, toPublic } from "./jobs.js";
import { assertPublicHost, parseUrl } from "./security.js";
import { ffmpegAvailable, fetchInfo, ytdlpVersion } from "./ytdlp.js";

const app = express();
app.disable("x-powered-by");
const tp = config.trustProxy;
app.set("trust proxy", /^\d+$/.test(tp) ? Number(tp) : tp === "true" ? true : tp === "false" ? false : tp);

/* ── CORS: only your site (ALLOWED_ORIGINS) may call the API from a browser ── */
const anyOrigin = config.allowedOrigins.includes("*");
app.use(
  cors({
    origin: anyOrigin
      ? true
      : (origin, cb) => cb(null, !origin || config.allowedOrigins.includes(origin.replace(/\/$/, ""))),
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    exposedHeaders: ["Content-Disposition"],
    maxAge: 600,
  }),
);
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});
app.use(express.json({ limit: "10kb" }));

const limiter = (limit: number) =>
  rateLimit({
    windowMs: 60_000,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Too many requests. Please slow down and try again in a minute." },
  });

/* ── tiny in-memory cache so pasting the same link twice is instant ── */
const infoCache = new Map<string, { at: number; info: VideoInfo }>();
const inflight = new Map<string, Promise<VideoInfo>>();
const INFO_TTL = 5 * 60_000;

async function cachedInfo(url: string): Promise<VideoInfo> {
  const hit = infoCache.get(url);
  if (hit && Date.now() - hit.at < INFO_TTL) return hit.info;
  let p = inflight.get(url);
  if (!p) {
    p = fetchInfo(url)
      .then((info) => {
        if (infoCache.size > 200) infoCache.delete(infoCache.keys().next().value!);
        infoCache.set(url, { at: Date.now(), info });
        return info;
      })
      .finally(() => inflight.delete(url));
    inflight.set(url, p);
  }
  return p;
}

/* ── routes ── */
let health = { ytdlp: null as string | null, ffmpeg: false };

app.get("/api/health", (_req, res) => {
  res.json({
    ok: Boolean(health.ytdlp) && health.ffmpeg,
    ytdlp: health.ytdlp,
    ffmpeg: health.ffmpeg,
    limits: { maxDurationMin: config.maxDurationMin, maxFileSizeMb: config.maxFileSizeMb },
  });
});

app.post("/api/info", limiter(config.infoPerMinute), async (req, res) => {
  const url = parseUrl(req.body?.url);
  await assertPublicHost(url);
  const info = await cachedInfo(url.toString());
  res.json({ info });
});

app.post("/api/jobs", limiter(config.jobsPerMinute), async (req, res) => {
  const { kind, quality } = req.body ?? {};
  if (kind !== "mp4" && kind !== "mp3") throw new UserError("Choose MP4 or MP3.");
  const q = Number(quality);
  if (kind === "mp3" && !(MP3_BITRATES as readonly number[]).includes(q)) {
    throw new UserError("Choose a valid MP3 quality.");
  }
  if (kind === "mp4" && !(Number.isInteger(q) && q >= 0 && q <= 4320)) {
    throw new UserError("Choose a valid video quality.");
  }
  const url = parseUrl(req.body?.url);
  await assertPublicHost(url);
  const job = createJob({ url: url.toString(), kind: kind as Kind, quality: q, ip: req.ip ?? "unknown" });
  res.status(202).json({ id: job.id });
});

app.get("/api/jobs/:id", (req, res) => {
  const job = getJob(req.params.id);
  if (!job) throw new UserError("This download has expired. Please start again.", 404);
  res.setHeader("Cache-Control", "no-store");
  res.json(toPublic(job));
});

app.get("/api/jobs/:id/file", (req, res, next) => {
  const job = getJob(req.params.id);
  if (!job) throw new UserError("This download has expired. Please start again.", 404);
  if (job.status !== "done" || !job.filePath || !job.fileName) {
    throw new UserError("The file isn't ready yet.", 409);
  }
  res.setHeader("Cache-Control", "no-store");
  res.type(job.kind === "mp3" ? "audio/mpeg" : "video/mp4");
  res.download(job.filePath, job.fileName, (err) => {
    if (err && !res.headersSent) next(err);
  });
});

app.delete("/api/jobs/:id", (req, res) => {
  if (!cancelJob(req.params.id)) throw new UserError("Download not found.", 404);
  res.status(204).end();
});

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found." });
});

/* ── optional: serve the built frontend from the same server (single-host deploys) ── */
const staticDir = process.env.STATIC_DIR;
if (staticDir && fs.existsSync(staticDir)) {
  app.use(express.static(staticDir, { maxAge: "1h", index: false }));
  app.get(/.*/, (_req, res) => res.sendFile(path.resolve(staticDir, "index.html")));
}

const onError: ErrorRequestHandler = (err, _req, res, _next) => {
  if (res.headersSent) return;
  if (err instanceof UserError) return void res.status(err.status).json({ error: err.message });
  if (err?.type === "entity.parse.failed" || err instanceof SyntaxError) {
    return void res.status(400).json({ error: "Invalid request." });
  }
  if (err?.code === "ENOENT") return void res.status(404).json({ error: "This file has expired." });
  console.error("[error]", err);
  res.status(500).json({ error: "Something went wrong on the server." });
};
app.use(onError);

/* ── boot ── */
async function main() {
  await initJobs();
  health = { ytdlp: await ytdlpVersion(), ffmpeg: await ffmpegAvailable() };
  app.listen(config.port, () => {
    console.log(`md download API on :${config.port}  (yt-dlp ${health.ytdlp ?? "MISSING"}, ffmpeg ${health.ffmpeg ? "ok" : "MISSING"})`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

export { app, main };
