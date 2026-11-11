"""
md download API for Vercel (Python serverless function, FastAPI).

Stateless "direct" mode: GET /api/download downloads with yt-dlp into /tmp, converts with ffmpeg and
streams the finished file back in the same request (no job queue / polling, which serverless can't keep).
"""
import ipaddress
import os
import re
import shutil
import socket
import stat
import tempfile
import uuid
from urllib.parse import quote, urlparse

import imageio_ffmpeg
import yt_dlp
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from starlette.background import BackgroundTask

MAX_FILE_MB = int(os.environ.get("MAX_FILE_SIZE_MB", "400"))
MAX_DURATION_MIN = int(os.environ.get("MAX_DURATION_MIN", "60"))
ALLOW_PRIVATE = os.environ.get("DEV_ALLOW_PRIVATE_HOSTS") == "1"
ALLOW_GENERIC = os.environ.get("ALLOW_GENERIC") == "1"
ORIGINS = [o.strip().rstrip("/") for o in os.environ.get("ALLOWED_ORIGINS", "*").split(",") if o.strip()]
MP3_BITRATES = (320, 256, 192, 128, 64)
TMP_ROOT = os.path.join(tempfile.gettempdir(), "mddl")

# yt-dlp wants a directory containing a binary literally named "ffmpeg".
_ff_dir = os.path.join(tempfile.gettempdir(), "ffbin")


def ffmpeg_dir() -> str:
    target = os.path.join(_ff_dir, "ffmpeg")
    if not os.path.exists(target):
        os.makedirs(_ff_dir, exist_ok=True)
        shutil.copy(imageio_ffmpeg.get_ffmpeg_exe(), target)
        os.chmod(target, os.stat(target).st_mode | stat.S_IEXEC)
    return _ff_dir


class UserError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message, self.status = message, status


app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if "*" in ORIGINS else ORIGINS,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "Content-Length"],
    max_age=600,
)


@app.exception_handler(UserError)
async def _user_error(_req, exc: UserError):
    return JSONResponse({"error": exc.message}, status_code=exc.status)


# ───────────────────────── security ─────────────────────────
def parse_url(raw: str) -> str:
    raw = (raw or "").strip()
    if not raw:
        raise UserError("Please paste a video link.")
    if len(raw) > 2048:
        raise UserError("That link is too long.")
    if not re.match(r"^[a-z][a-z0-9+.-]*://", raw, re.I):
        raw = "https://" + raw
    u = urlparse(raw)
    if u.scheme not in ("http", "https") or not u.hostname or "." not in u.hostname:
        raise UserError("That doesn't look like a valid link.")
    if u.username or u.password:
        raise UserError("Links with embedded credentials are not allowed.")
    if not ALLOW_PRIVATE:
        host = u.hostname.lower()
        if host == "localhost" or host.endswith((".localhost", ".local", ".internal")):
            raise UserError("That address isn't allowed.")
        try:
            addrs = {a[4][0] for a in socket.getaddrinfo(host, None)}
        except OSError:
            raise UserError("Couldn't find that website. Check the link and try again.")
        if not addrs or any(not ipaddress.ip_address(a.split("%")[0]).is_global for a in addrs):
            raise UserError("That address isn't allowed.")
    return raw


ERROR_RULES = [
    (r"unsupported url", "That link isn't supported. Paste a direct link to a single video."),
    (r"not a bot|http error 429|too many requests", "The platform is temporarily limiting this server. Please try again in a few minutes."),
    (r"confirm your age|age.restricted|inappropriate for some users", "This video is age-restricted and can't be downloaded without signing in."),
    (r"private video|login required|requires? (a )?login|please log in|sign in", "This video is private or requires a login, so it can't be downloaded."),
    (r"members.only|join this channel|premium|subscribers?.only", "This video is only for members or subscribers."),
    (r"requested format is not available", "That quality isn't available for this video. Please pick another one."),
    (r"video unavailable|not available|removed|no longer available|does not exist|deleted|404", "This video isn't available (removed, private, or blocked in this region)."),
    (r"live event|is live|premieres in", "Live streams and upcoming premieres can't be downloaded yet."),
    (r"drm", "This video is DRM-protected and can't be downloaded."),
    (r"larger than max-filesize|file is larger", f"That file is too large (limit {MAX_FILE_MB} MB)."),
    (r"ffmpeg|ffprobe|postprocessing", "Converting the file failed on the server. Please try a different quality."),
    (r"timed out|timeout|connection (reset|refused)|unable to download", "Couldn't reach the platform. Please try again."),
]


def friendly(msg: str) -> str:
    for pat, out in ERROR_RULES:
        if re.search(pat, msg, re.I):
            return out
    return "Sorry, this video couldn't be processed. Check the link and try again."


def base_opts() -> dict:
    o = {
        "quiet": True, "no_warnings": True, "noplaylist": True, "playlist_items": "1",
        "socket_timeout": 20, "retries": 3, "fragment_retries": 3, "ignoreconfig": True,
        "ffmpeg_location": ffmpeg_dir(), "cachedir": False,
    }
    if not ALLOW_GENERIC:
        o["allowed_extractors"] = ["default", "-generic"]
    return o


# ───────────────────────── info normalisation (mirror of server/src/format.ts) ─────────────────────────
PLATFORMS = {"youtube": "YouTube", "tiktok": "TikTok", "facebook": "Facebook", "instagram": "Instagram",
             "twitter": "X (Twitter)", "pinterest": "Pinterest", "reddit": "Reddit", "vimeo": "Vimeo",
             "dailymotion": "Dailymotion", "twitch": "Twitch", "soundcloud": "SoundCloud", "bilibili": "Bilibili",
             "snapchat": "Snapchat", "linkedin": "LinkedIn", "threads": "Threads"}


def platform_name(raw: dict) -> str:
    key = str(raw.get("extractor_key") or raw.get("extractor") or "").lower()
    for k, v in PLATFORMS.items():
        if key.startswith(k):
            return v
    name = str(raw.get("extractor_key") or raw.get("extractor") or "Web")
    return name[:1].upper() + name[1:]


def resolution(f: dict) -> int:
    w, h = f.get("width") or 0, f.get("height") or 0
    if w > 0 and h > 0:
        return min(w, h)
    if h > 0:
        return h
    m = re.search(r"(\d{3,4})p", str(f.get("format_note") or f.get("format") or ""), re.I)
    return int(m.group(1)) if m else 0


def size_of(f: dict, duration):
    s = f.get("filesize") or f.get("filesize_approx")
    if s and s > 0:
        return int(s)
    if f.get("tbr") and duration:
        return int(f["tbr"] * 1000 / 8 * duration)
    return None


def normalize(raw: dict) -> dict:
    formats = raw.get("formats") or ([raw] if raw.get("url") else [])
    duration = raw.get("duration") if (raw.get("duration") or 0) > 0 else None

    def storyboard(f):
        return f.get("ext") == "mhtml" or "storyboard" in str(f.get("format_note") or "").lower() or f.get("vcodec") == "images"

    video_fmts = [f for f in formats if f.get("vcodec") != "none" and not storyboard(f)
                  and (f.get("vcodec") is not None or f.get("acodec") is None or f.get("height"))]
    audio_fmts = [f for f in formats if f.get("acodec") != "none" and not storyboard(f)]
    audio_only = [f for f in formats if f.get("vcodec") == "none" and f.get("acodec") != "none" and not storyboard(f)]
    best_audio = max([size_of(f, duration) or 0 for f in audio_only] or [0]) or None

    by_res: dict = {}
    for f in video_fmts:
        by_res.setdefault(resolution(f), []).append(f)
    video = []
    known = sorted((r for r in by_res if r > 0), reverse=True)
    for res in known:
        sized = sorted(((size_of(f, duration), f) for f in by_res[res] if size_of(f, duration)), key=lambda x: -x[0])
        approx = None
        if sized:
            s, f = sized[0]
            approx = s + ((best_audio or 0) if f.get("acodec") == "none" else 0)
        video.append({"res": res, "label": f"{res}p", "approxBytes": approx})
    if not known and video_fmts:
        video = [{"res": 0, "label": "Best available"}]

    has_video = bool(video)
    has_audio = bool(audio_fmts) or (not has_video and bool(formats))
    audio = []
    if has_audio:
        for k in MP3_BITRATES:
            label = "320 kbps · Best" if k == 320 else "128 kbps · Standard" if k == 128 else f"{k} kbps"
            audio.append({"kbps": k, "label": label, "approxBytes": int(k * 1000 / 8 * duration) if duration else None})

    thumb = raw.get("thumbnail")
    if not isinstance(thumb, str):
        thumbs = [t for t in (raw.get("thumbnails") or []) if str(t.get("url", "")).startswith("http")]
        thumb = thumbs[-1]["url"] if thumbs else None
    return {
        "id": str(raw.get("id") or ""), "title": str(raw.get("title") or "Untitled video")[:300],
        "uploader": raw.get("uploader") or raw.get("channel"), "duration": duration, "thumbnail": thumb,
        "platform": platform_name(raw), "webpageUrl": str(raw.get("webpage_url") or raw.get("original_url") or ""),
        "hasVideo": has_video, "hasAudio": has_audio, "video": video, "audio": audio,
    }


# ───────────────────────── routes ─────────────────────────
@app.get("/api/health")
def health():
    return {"ok": True, "mode": "direct", "ytdlp": yt_dlp.version.__version__, "ffmpeg": True,
            "limits": {"maxDurationMin": MAX_DURATION_MIN, "maxFileSizeMb": MAX_FILE_MB}}


@app.post("/api/info")
def info(body: dict):
    url = parse_url(str(body.get("url", "")))
    try:
        with yt_dlp.YoutubeDL(base_opts()) as ydl:
            raw = ydl.sanitize_info(ydl.extract_info(url, download=False))
    except yt_dlp.utils.DownloadError as e:
        raise UserError(friendly(str(e)), 422)
    entry = next((e for e in raw.get("entries", []) if e), None) if raw.get("_type") == "playlist" else raw
    if not entry:
        raise UserError("No downloadable video or audio was found at that link.", 422)
    out = normalize(entry)
    if not out["webpageUrl"]:
        out["webpageUrl"] = url
    if not out["hasVideo"] and not out["hasAudio"]:
        raise UserError("No downloadable video or audio was found at that link.", 422)
    if MAX_DURATION_MIN and out["duration"] and out["duration"] > MAX_DURATION_MIN * 60:
        raise UserError(f"Videos longer than {MAX_DURATION_MIN} minutes aren't supported here.", 422)
    return {"info": out}


def _chunks(path: str, size: int = 1024 * 1024):
    with open(path, "rb") as f:
        while chunk := f.read(size):
            yield chunk


@app.get("/api/download")
def download(url: str = Query(...), kind: str = Query(...), quality: int = Query(0)):
    if kind not in ("mp4", "mp3"):
        raise UserError("Choose MP4 or MP3.")
    if kind == "mp3" and quality not in MP3_BITRATES:
        raise UserError("Choose a valid MP3 quality.")
    if kind == "mp4" and not 0 <= quality <= 4320:
        raise UserError("Choose a valid video quality.")
    url = parse_url(url)

    workdir = os.path.join(TMP_ROOT, uuid.uuid4().hex)
    os.makedirs(workdir, exist_ok=True)
    opts = base_opts() | {
        "outtmpl": os.path.join(workdir, "%(title).120B.%(ext)s"),
        "windowsfilenames": True, "concurrent_fragment_downloads": 4, "max_filesize": MAX_FILE_MB * 1024 * 1024,
        "overwrites": True,
    }
    if MAX_DURATION_MIN:
        opts["match_filter"] = yt_dlp.utils.match_filter_func(f"duration<=?{MAX_DURATION_MIN * 60}")
    if kind == "mp4":
        opts |= {
            "format": "bv*+ba/b",
            "format_sort": [f"res:{quality}" if quality else "res", "vcodec:h264", "fps", "acodec:aac", "ext:mp4:m4a"],
            "merge_output_format": "mp4",
            "postprocessors": [{"key": "FFmpegVideoRemuxer", "preferedformat": "mp4"}],
        }
    else:
        opts |= {
            "format": "ba/b",
            "postprocessors": [
                {"key": "FFmpegExtractAudio", "preferredcodec": "mp3", "preferredquality": str(quality)},
                {"key": "FFmpegMetadata"},
            ],
        }
    cleanup = BackgroundTask(shutil.rmtree, workdir, True)
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            ydl.download([url])
    except yt_dlp.utils.DownloadError as e:
        shutil.rmtree(workdir, ignore_errors=True)
        raise UserError(friendly(str(e)), 422)
    except Exception:
        shutil.rmtree(workdir, ignore_errors=True)
        raise UserError("Something went wrong while downloading. Please try again.", 500)

    files = [n for n in os.listdir(workdir) if not re.search(r"\.(part|ytdl|temp|tmp)$|\.f\d+\.[a-z0-9]+$", n, re.I)]
    wanted = [n for n in files if n.lower().endswith("." + kind)] or files
    if not wanted:
        shutil.rmtree(workdir, ignore_errors=True)
        raise UserError(f"That file is too large or too long for this server (limit {MAX_FILE_MB} MB / {MAX_DURATION_MIN} min).", 422)
    name = wanted[0]
    path = os.path.join(workdir, name)
    ascii_name = re.sub(r'[^\x20-\x7e]', "_", name).replace('"', "'")
    headers = {
        "Content-Disposition": f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{quote(name)}",
        "Content-Length": str(os.path.getsize(path)),
        "Cache-Control": "no-store",
    }
    return StreamingResponse(_chunks(path), media_type="audio/mpeg" if kind == "mp3" else "video/mp4",
                             headers=headers, background=cleanup)
