/**
 * Plain-HTTP access to YouTube's own web API (InnerTube) for search and mixes.
 *
 * Unlike the player endpoint used by yt-dlp to get audio URLs, these endpoints
 * are not gated by the "confirm you're not a bot" challenge that YouTube shows
 * to datacenter IPs (Render, Fly…). They are also ~10x faster than spawning
 * yt-dlp. The response shapes are YouTube's internal ones and can change, so
 * every caller keeps yt-dlp as a fallback.
 */

export interface RawVideo {
  id: string;
  title: string;
  channel: string;
  duration: number;
  live: boolean;
}

const ENDPOINT = 'https://www.youtube.com/youtubei/v1';
const CLIENT = { clientName: 'WEB', clientVersion: '2.20261101.00.00', hl: 'en', gl: 'US' };
/** Search filter "Type: Video" — the classic `videoRenderer` items, without shorts/channels/playlists. */
const VIDEOS_ONLY = 'EgIQAQ==';

async function call(path: string, body: Record<string, unknown>, timeoutMs = 10000): Promise<any> {
  const r = await fetch(`${ENDPOINT}/${path}?prettyPrint=false`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
      'X-YouTube-Client-Name': '1',
      'X-YouTube-Client-Version': CLIENT.clientVersion,
      Origin: 'https://www.youtube.com',
    },
    body: JSON.stringify({ context: { client: CLIENT }, ...body }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!r.ok) throw new Error(`InnerTube ${path}: HTTP ${r.status}`);
  return r.json();
}

/** "3:31" / "1:02:03" → seconds (0 when unknown). */
export function parseClock(text: string | undefined): number {
  if (!text || !/^\d+(:\d{1,2})+$/.test(text.trim())) return 0;
  return text.trim().split(':').reduce((acc, part) => acc * 60 + Number(part), 0);
}

const text = (t: any): string => t?.simpleText ?? (Array.isArray(t?.runs) ? t.runs.map((r: any) => r.text).join('') : '') ?? '';

/** Collects every object stored under `key`, at any depth. */
function collect(node: any, key: string, out: any[] = []): any[] {
  if (Array.isArray(node)) for (const v of node) collect(v, key, out);
  else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (k === key) out.push(v);
      else collect(v, key, out);
    }
  }
  return out;
}

function fromVideoRenderer(v: any): RawVideo | null {
  if (!v?.videoId || !v.title) return null;
  const badges = JSON.stringify(v.badges ?? []) + JSON.stringify(v.thumbnailOverlays ?? []);
  return {
    id: v.videoId,
    title: text(v.title),
    channel: text(v.ownerText) || text(v.longBylineText) || text(v.shortBylineText) || 'YouTube',
    duration: parseClock(text(v.lengthText)),
    live: /LIVE|BADGE_STYLE_TYPE_LIVE_NOW/.test(badges) && !v.lengthText,
  };
}

function fromPanelVideo(v: any): RawVideo | null {
  if (!v?.videoId || !v.title) return null;
  return {
    id: v.videoId,
    title: text(v.title),
    channel: text(v.shortBylineText) || text(v.longBylineText) || 'YouTube',
    duration: parseClock(text(v.lengthText)),
    live: false,
  };
}

export const innertube = {
  /** Up to `want` raw video results (one or two pages). */
  async search(query: string, want: number): Promise<RawVideo[]> {
    let data = await call('search', { query, params: VIDEOS_ONLY });
    const out: RawVideo[] = [];
    for (let page = 0; page < 2; page++) {
      for (const v of collect(data, 'videoRenderer')) {
        const video = fromVideoRenderer(v);
        if (video) out.push(video);
      }
      const token = collect(data, 'continuationCommand')[0]?.token;
      if (out.length >= want || !token) break;
      data = await call('search', { continuation: token });
    }
    return out.slice(0, want);
  },

  /** YouTube's "Mix" (RD playlist) for a video, the seed first. */
  async mix(videoId: string): Promise<RawVideo[]> {
    const data = await call('next', { videoId, playlistId: `RD${videoId}` });
    return collect(data, 'playlistPanelVideoRenderer').map(fromPanelVideo).filter((v): v is RawVideo => !!v);
  },
};
