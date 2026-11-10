#!/usr/bin/env node
/**
 * End-to-end self test against a running API.
 *   node scripts/e2e.mjs <video-url> [--api http://localhost:8787] [--out ./e2e-out] [--max-mp4 3]
 * Downloads the MP4 in several qualities and the MP3 in 320 / 128 kbps, then checks the
 * resulting files with ffprobe (resolution, codec, bitrate).
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (name, d) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : d;
};
const url = args.find((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
if (!url) {
  console.error("usage: node scripts/e2e.mjs <video-url> [--api URL] [--out DIR] [--max-mp4 N]");
  process.exit(2);
}
const API = opt("api", "http://localhost:8787");
const OUT = path.resolve(opt("out", "./e2e-out"));
const MAX_MP4 = Number(opt("max-mp4", 3));
fs.mkdirSync(OUT, { recursive: true });

let failures = 0;
const check = (ok, msg) => {
  console.log(`${ok ? "  ✔" : "  ✘"} ${msg}`);
  if (!ok) failures++;
};
const json = async (method, p, body) => {
  const r = await fetch(API + p, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = r.status === 204 ? null : await r.json().catch(() => null);
  return { status: r.status, data };
};
const probe = (file) =>
  JSON.parse(
    execFileSync("ffprobe", ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", file], {
      encoding: "utf8",
    }),
  );

async function download(kind, quality) {
  const start = await json("POST", "/api/jobs", { url, kind, quality });
  if (start.status !== 202) throw new Error(`job start failed: ${JSON.stringify(start)}`);
  const id = start.data.id;
  let job;
  const seen = new Set();
  for (let i = 0; i < 600; i++) {
    job = (await json("GET", `/api/jobs/${id}`)).data;
    seen.add(`${job.stage}`);
    if (job.status === "done" || job.status === "error") break;
    await new Promise((r) => setTimeout(r, 500));
  }
  if (job.status !== "done") throw new Error(`job failed: ${job.error}`);
  const res = await fetch(`${API}/api/jobs/${id}/file`);
  const cd = res.headers.get("content-disposition");
  const buf = Buffer.from(await res.arrayBuffer());
  const file = path.join(OUT, `${kind}-${quality}${kind === "mp3" ? ".mp3" : ".mp4"}`);
  fs.writeFileSync(file, buf);
  return { file, job, cd, bytes: buf.length, stages: [...seen] };
}

console.log(`API ${API}\nURL ${url}\n`);
const health = (await json("GET", "/api/health")).data;
check(health?.ok === true, `health ok (yt-dlp ${health?.ytdlp}, ffmpeg ${health?.ffmpeg})`);

const info = (await json("POST", "/api/info", { url })).data?.info;
check(Boolean(info), `info: "${info?.title}" · ${info?.platform}${info?.duration ? ` · ${info.duration}s` : ""}`);
if (!info) process.exit(1);
console.log("  video qualities:", info.video.map((v) => v.label).join(", ") || "none");
console.log("  audio qualities:", info.audio.map((a) => a.kbps).join(", ") || "none");

for (const v of info.video.slice(0, MAX_MP4)) {
  console.log(`\nMP4 ${v.label}`);
  const r = await download("mp4", v.res);
  const p = probe(r.file);
  const vs = p.streams.find((s) => s.codec_type === "video");
  const as = p.streams.find((s) => s.codec_type === "audio");
  const short = Math.min(vs.width, vs.height);
  check(r.bytes > 1000, `file ${(r.bytes / 1024).toFixed(0)} KiB, ${r.cd}`);
  check(vs.codec_name === "h264", `video codec ${vs.codec_name} ${vs.width}x${vs.height}`);
  check(v.res === 0 || short === v.res, `resolution ${short}p (asked ${v.res ? v.res + "p" : "best"})`);
  check(Boolean(as), `audio track ${as?.codec_name}`);
  check(p.format.format_name.includes("mp4"), `container ${p.format.format_name}`);
}

if (info.audio.length) {
  for (const kbps of [320, 128]) {
    console.log(`\nMP3 ${kbps} kbps`);
    const r = await download("mp3", kbps);
    const p = probe(r.file);
    const as = p.streams.find((s) => s.codec_type === "audio");
    const br = Number(as.bit_rate) / 1000;
    check(as.codec_name === "mp3", `codec ${as.codec_name}`);
    check(Math.abs(br - kbps) / kbps < 0.15, `bitrate ${br.toFixed(0)} kbps (asked ${kbps})`);
    check(!p.streams.some((s) => s.codec_type === "video" && s.codec_name !== "mjpeg" && s.codec_name !== "png"), "no video stream");
  }
}

console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed ✔");
process.exit(failures ? 1 : 0);
