#!/bin/sh
# YouTube challenges requests coming from datacenter IPs (Render, CI, VPS).
# Pasted cookies make yt-dlp look like a signed-in browser and lift most of them.
#
#   base64 -w0 cookies.txt   →   paste into the YTDLP_COOKIES_B64 env var
#
# Dashboards and terminals often add line breaks, spaces or quotes around the value,
# so the input is normalised before decoding. A bad value never stops the service:
# it only means yt-dlp runs without cookies.
#
# YTDLP_COOKIES (a path) wins if both are set: it points at a file mounted another way.
set -e

COOKIE_FILE=/tmp/yt-dlp-cookies.txt

decode_cookies() {
  # Accept the url-safe alphabet, then drop everything that is not base64.
  cleaned=$(printf '%s' "$YTDLP_COOKIES_B64" | tr -- '-_' '+/' | tr -c -d 'A-Za-z0-9+/=')
  [ -n "$cleaned" ] || return 1
  # Restore missing padding.
  case $((${#cleaned} % 4)) in
    2) cleaned="$cleaned==" ;;
    3) cleaned="$cleaned=" ;;
  esac
  printf '%s' "$cleaned" | base64 -d > "$COOKIE_FILE" 2>/dev/null || return 1
  # A Netscape cookie file has tab-separated rows; anything else means a bad paste.
  awk -F'\t' 'NF >= 6 { found = 1 } END { exit !found }' "$COOKIE_FILE" || return 1
}

if [ -n "$YTDLP_COOKIES_B64" ] && [ -z "$YTDLP_COOKIES" ]; then
  if decode_cookies; then
    chmod 600 "$COOKIE_FILE"
    YTDLP_COOKIES="$COOKIE_FILE"
    export YTDLP_COOKIES
    echo "[entrypoint] YouTube cookies loaded from YTDLP_COOKIES_B64 ($(wc -c < "$COOKIE_FILE") bytes)"
  else
    rm -f "$COOKIE_FILE"
    echo "[entrypoint] YTDLP_COOKIES_B64 could not be decoded: yt-dlp runs without cookies" >&2
  fi
else
  echo "[entrypoint] no YTDLP_COOKIES_B64: yt-dlp runs without cookies (YouTube may block it)"
fi

exec "$@"
