# md download

A free, no-sign-up video & audio downloader for YouTube, Shorts, TikTok, Facebook, Pinterest, Instagram, X, Reddit and
[1000+ other sites](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md). Paste a link, choose **MP4** (pick the
resolution) or **MP3** (pick the bitrate), download.

* **Frontend:** React + TypeScript + Vite, Tailwind v4, shadcn/ui-style components (Radix), anime.js, Uiverse-style effects.
  Palette: electric blue `#2b7bff`, dark black `#050608`, smoke white `#f5f5f5`: nothing else.
* **Backend:** Node + Express + TypeScript around the free, open-source [yt-dlp](https://github.com/yt-dlp/yt-dlp) and
  [ffmpeg](https://ffmpeg.org). **No paid APIs, no API keys.**

```
 Browser (React site on Netlify)  ──HTTPS──►  API (Node + yt-dlp + ffmpeg on Docker / Render / VPS)
```

**Why two parts?** Netlify serves static files and short serverless functions. Downloading and converting video needs a
long-running process, ffmpeg and disk space, so the API runs on any small server and the site just talks to it.

---

## Run it locally

You need Node 20+, `ffmpeg`, and `yt-dlp` on your PATH (`pip install -U "yt-dlp[default]"`).

```bash
npm run setup     # installs the site and the server
npm run server    # API   → http://localhost:8787
npm run dev       # site  → http://localhost:5173  (proxies /api to the API)
```

---

## Deploy

### 1) The API (backend)

**Docker (any host):**

```bash
docker build -t md-download-api ./server
docker run -p 8787:8787 -e ALLOWED_ORIGINS=https://YOUR-SITE.netlify.app md-download-api
```

**Render (one click):** New → *Blueprint* → pick this repo (`render.yaml` is included), then set `ALLOWED_ORIGINS`
to your Netlify URL. Railway, Fly.io, Koyeb or a plain VPS work the same way with `server/Dockerfile`.

Settings (environment variables, all optional, see `server/.env.example`):

| Variable | Default | Meaning |
| --- | --- | --- |
| `ALLOWED_ORIGINS` | `*` | Comma-separated sites allowed to call the API. **Set this to your Netlify URL.** |
| `MAX_CONCURRENT_JOBS` | `2` | Parallel downloads. Raise it only if the server has the CPU/RAM. |
| `MAX_FILE_SIZE_MB` / `MAX_DURATION_MIN` | `1024` / `180` | Refuse bigger / longer videos. |
| `FILE_TTL_MINUTES` | `15` | Finished files are deleted after this long. |
| `INFO_PER_MINUTE` / `JOBS_PER_MINUTE` | `20` / `6` | Rate limit per IP. |
| `COOKIES_FILE` / `YTDLP_PROXY` | – | See "YouTube from a server" below. |
| `AUTO_UPDATE_YTDLP` | `1` | Docker: update yt-dlp on every boot. |

**Vercel (free, no card) — "direct mode":** import this repo in Vercel (framework Vite, root = repo root). `vercel.json`
and `api/index.py` (FastAPI + yt-dlp + ffmpeg) are picked up automatically, so one Vercel project serves the site *and* the
API on the same origin. Optionally set `ALLOWED_ORIGINS` (e.g. `https://md-dev-download.netlify.app`) to let a Netlify
copy of the site call it, and put the Vercel URL in `public/config.json` → `apiBase`. Limits: no queue or live progress
from the server (the browser shows download progress), ~300 s per file, small files only, YouTube often blocked from
Vercel IPs.

### 2) The site on Netlify

Pick one:

* **Git (recommended):** push this folder to GitHub → Netlify → *Add new site → Import from Git*. `netlify.toml`
  already sets the build command (`npm run build`) and publish folder (`dist`). Add the environment variable
  `VITE_API_BASE = https://your-api.example.com` and deploy.
* **Drag & drop (no build tools on Netlify):** `npm install && npm run build`, open `dist/config.json`, set
  `"apiBase": "https://your-api.example.com"`, then drag the `dist` folder onto <https://app.netlify.com/drop>.
  To change the server later, edit that file and re-drop.
* **CLI:** `npm run build && npx netlify-cli deploy --prod --dir=dist`.

Open the site. If the "Download server not connected" box shows, the site can't reach the API: check the URL, and that
`ALLOWED_ORIGINS` contains your site's address. (That box also has a *Connect server* button that saves a URL in your own
browser, which is handy for testing.)

---

## Things worth knowing

* **YouTube from a server.** YouTube often answers data-centre IPs with *"Sign in to confirm you're not a bot"*. TikTok,
  Facebook, Pinterest and most other sites don't care. If YouTube fails on your host, either export a `cookies.txt` from a
  logged-in browser and set `COOKIES_FILE`, route yt-dlp through a residential proxy with `YTDLP_PROXY`, or run the API on
  a home PC behind a free Cloudflare Tunnel.
* **Keep yt-dlp fresh.** Platforms change often and yt-dlp ships fixes within days. The Docker image updates it on every
  boot; elsewhere run `pip install -U "yt-dlp[default]"` regularly.
* **Quality.** MP4 picks the best stream whose *shorter side* is ≤ the chosen resolution (so vertical videos work) and
  prefers H.264 + AAC so files play everywhere. 1440p/4K on YouTube only exist as VP9/AV1, which play fine in VLC/Chrome
  but not in QuickTime. MP3 is converted at the bitrate you pick; it can't exceed the source's audio quality.
* **Safety built in.** Private/internal addresses are blocked (SSRF), the "generic" extractor is off so only real
  platforms are fetched, per-IP rate limits and concurrency caps, size/duration caps, auto-deleted files, CORS lock.
* **Legal.** This is a tool: only download what you own, what is licensed for reuse, or what you have permission to save,
  and respect each platform's terms. Keep the disclaimer in the footer.

---

## Tests

```bash
npm --prefix server test                      # unit tests (format selection, URL/SSRF guard, progress parsing)
npm --prefix server run e2e -- <video-url>    # real download: MP4 in several qualities + MP3 320/128, checked with ffprobe
```

## Layout

```
src/                 React site (components/ui = shadcn-style, hooks/, lib/api.ts)
public/config.json   optional runtime API address
server/src/          Express API: format.ts (qualities → yt-dlp args), ytdlp.ts, jobs.ts, security.ts, index.ts
server/Dockerfile    API image (Node + ffmpeg + yt-dlp)
netlify.toml         Netlify build + headers
render.yaml          Render blueprint for the API
```
