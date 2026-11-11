#!/bin/sh
# yt-dlp breaks whenever a platform changes something, so update it on every boot.
# Set AUTO_UPDATE_YTDLP=0 to skip (e.g. when you pin a version).
if [ "${AUTO_UPDATE_YTDLP:-1}" = "1" ]; then
  pip install --quiet --upgrade "yt-dlp[default]" || echo "yt-dlp update skipped (offline?)"
fi
exec node --import tsx src/index.ts
