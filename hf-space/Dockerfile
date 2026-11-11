# md download API – Node + yt-dlp + ffmpeg
FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    PORT=8787 \
    ALLOWED_ORIGINS=https://md-dev-download.netlify.app,https://md-download.netlify.app \
    TMP_DIR=/tmp/md-download \
    XDG_CACHE_HOME=/tmp/.cache \
    PIP_NO_CACHE_DIR=1 \
    PATH=/opt/venv/bin:$PATH

RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg python3 python3-venv ca-certificates \
 && python3 -m venv /opt/venv \
 && /opt/venv/bin/pip install "yt-dlp[default]" \
 && chown -R node:node /opt/venv \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY tsconfig.json start.sh ./
COPY src ./src

USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["sh", "start.sh"]
