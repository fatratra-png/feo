#!/bin/sh
# YouTube challenges requests coming from datacenter IPs (Render, CI, VPS).
# Pasted cookies make yt-dlp look like a signed-in browser and lift most of them.
#
#   base64 -w0 cookies.txt   →   paste into the YTDLP_COOKIES_B64 env var
#
# YTDLP_COOKIES (a path) wins if both are set: it points at a file mounted another way.
set -e

if [ -n "$YTDLP_COOKIES_B64" ] && [ -z "$YTDLP_COOKIES" ]; then
  printf '%s' "$YTDLP_COOKIES_B64" | base64 -d > /tmp/yt-dlp-cookies.txt
  chmod 600 /tmp/yt-dlp-cookies.txt
  YTDLP_COOKIES=/tmp/yt-dlp-cookies.txt
  export YTDLP_COOKIES
  echo "[entrypoint] YouTube cookies loaded from YTDLP_COOKIES_B64"
else
  echo "[entrypoint] no YTDLP_COOKIES_B64: yt-dlp runs without cookies (YouTube may block it)"
fi

exec "$@"
