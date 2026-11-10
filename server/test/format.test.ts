import test from "node:test";
import assert from "node:assert/strict";
import { baseArgs, buildDownloadArgs, buildInfoArgs, friendlyError, normalizeInfo } from "../src/format.js";
import { overallProgress, parseProgressLine } from "../src/ytdlp.js";

const vf = (id: string, h: number, w: number, vcodec: string, extra = {}) => ({
  format_id: id, ext: "mp4", width: w, height: h, vcodec, acodec: "none", filesize: h * 40_000, ...extra,
});
const af = (id: string, acodec: string, abr: number) => ({
  format_id: id, ext: "m4a", vcodec: "none", acodec, abr, filesize: abr * 12_000,
});

test("YouTube-style formats → descending resolution list + MP3 bitrates", () => {
  const info = normalizeInfo({
    id: "abc", title: "Demo", extractor_key: "Youtube", duration: 200, webpage_url: "https://youtu.be/abc",
    formats: [
      af("140", "mp4a.40.2", 129), af("251", "opus", 135),
      vf("160", 144, 256, "avc1"), vf("135", 480, 854, "avc1"), vf("137", 1080, 1920, "avc1"),
      vf("303", 1080, 1920, "vp9", { fps: 60 }), vf("313", 2160, 3840, "vp9"),
      { format_id: "sb0", ext: "mhtml", vcodec: "none", acodec: "none", format_note: "storyboard" },
    ],
  });
  assert.equal(info.platform, "YouTube");
  assert.deepEqual(info.video.map((v) => v.res), [2160, 1080, 480, 144]);
  assert.deepEqual(info.video.map((v) => v.label), ["2160p", "1080p", "480p", "144p"]);
  assert.ok(info.video.every((v) => v.approxBytes && v.approxBytes > 0));
  assert.ok(info.hasVideo && info.hasAudio);
  assert.deepEqual(info.audio.map((a) => a.kbps), [320, 256, 192, 128, 64]);
});

test("vertical videos are labelled by their shorter side (Shorts / TikTok)", () => {
  const info = normalizeInfo({
    id: "s", title: "Short", extractor_key: "TikTok",
    formats: [
      { format_id: "a", ext: "mp4", width: 1080, height: 1920, vcodec: "h264", acodec: "aac" },
      { format_id: "b", ext: "mp4", width: 720, height: 1280, vcodec: "h264", acodec: "aac" },
    ],
  });
  assert.equal(info.platform, "TikTok");
  assert.deepEqual(info.video.map((v) => v.res), [1080, 720]);
});

test("audio-only source → no MP4 qualities, MP3 still offered", () => {
  const info = normalizeInfo({ id: "x", title: "Song", extractor_key: "Soundcloud", formats: [af("1", "mp3", 128)] });
  assert.equal(info.hasVideo, false);
  assert.equal(info.hasAudio, true);
  assert.equal(info.video.length, 0);
  assert.equal(info.audio.length, 5);
});

test("silent video → MP4 only", () => {
  const info = normalizeInfo({ id: "x", title: "Clip", extractor_key: "Pinterest", formats: [vf("v", 720, 1280, "h264")] });
  assert.equal(info.hasVideo, true);
  assert.equal(info.hasAudio, false);
  assert.equal(info.audio.length, 0);
});

test("single direct URL with unknown resolution → 'Best available'", () => {
  const info = normalizeInfo({ id: "x", title: "File", extractor_key: "Generic", url: "https://e.com/a.mp4", ext: "mp4" });
  assert.deepEqual(info.video, [{ res: 0, label: "Best available" }]);
  assert.equal(info.hasAudio, true);
});

test("MP4 args: resolution cap, H.264/AAC preference, merge into mp4, URL after --", () => {
  const a = buildDownloadArgs({ url: "https://youtu.be/abc", kind: "mp4", quality: 720, outDir: "/tmp/j" });
  const sort = a[a.indexOf("-S") + 1];
  assert.ok(sort.startsWith("res:720,vcodec:h264"), sort);
  assert.equal(a[a.indexOf("-f") + 1], "bv*+ba/b");
  assert.equal(a[a.indexOf("--merge-output-format") + 1], "mp4");
  assert.deepEqual(a.slice(-2), ["--", "https://youtu.be/abc"]);
  assert.ok(a.includes("--no-playlist"));
  assert.ok(!a.includes("-x"));
});

test("MP3 args: extract audio at the chosen bitrate", () => {
  const a = buildDownloadArgs({ url: "https://youtu.be/abc", kind: "mp3", quality: 192, outDir: "/tmp/j" });
  assert.ok(a.includes("-x"));
  assert.equal(a[a.indexOf("--audio-format") + 1], "mp3");
  assert.equal(a[a.indexOf("--audio-quality") + 1], "192K");
});

test("generic extractor is excluded by default; options can't be injected through the URL", () => {
  assert.ok(baseArgs().join(" ").includes("default,-generic"));
  const a = buildInfoArgs("https://x.com/--exec=rm");
  assert.equal(a[a.length - 2], "--");
});

test("progress mapping is monotonic across stream 1 → stream 2 → processing", () => {
  const p = [
    overallProgress("mp4", 2, 0, 0), overallProgress("mp4", 2, 0, 1),
    overallProgress("mp4", 2, 1, 0), overallProgress("mp4", 2, 1, 1),
  ];
  assert.deepEqual(p, [...p].sort((x, y) => x - y));
  assert.ok(p[3] < 96);
  assert.ok(overallProgress("mp3", 1, 0, 1) <= 85);
  assert.equal(overallProgress("mp4", 1, 0, 2), 94); // clamps
});

test("progress line parsing (incl. '|' in file names and NA values)", () => {
  const r = parseProgressLine("MDDL|500|1000|NA|2048.5|12|/tmp/a|b.f137.mp4");
  assert.equal(r.frac, 0.5);
  assert.equal(r.speed, 2048.5);
  assert.equal(r.eta, 12);
  assert.equal(r.filename, "/tmp/a|b.f137.mp4");
  assert.equal(parseProgressLine("MDDL|10|NA|100|NA|NA|f").frac, 0.1);
  assert.equal(parseProgressLine("MDDL|NA|NA|NA|NA|NA|f").frac, 0);
});

test("yt-dlp errors become friendly messages", () => {
  assert.match(friendlyError("ERROR: [youtube] x: Sign in to confirm you’re not a bot"), /temporarily limiting/);
  assert.match(friendlyError("ERROR: Unsupported URL: https://e.com"), /isn't supported/);
  assert.match(friendlyError("ERROR: [youtube] x: Private video. Sign in if you've been granted access"), /private/i);
  assert.match(friendlyError("ERROR: Requested format is not available. Use --list-formats"), /quality isn't available/);
  assert.match(friendlyError("garbage"), /couldn't be processed/);
});
