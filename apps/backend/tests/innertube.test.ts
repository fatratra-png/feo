import { expect } from 'chai';
import { innertube, parseClock } from '../src/services/innertube';
import { youtube } from '../src/services/youtube';

/* Minimal shapes of YouTube's InnerTube responses (only the fields we read). */
const videoRenderer = (id: string, title: string, channel: string, length?: string, live = false) => ({
  videoRenderer: {
    videoId: id,
    title: { runs: [{ text: title }] },
    ownerText: { runs: [{ text: channel }] },
    ...(length ? { lengthText: { simpleText: length } } : {}),
    ...(live ? { badges: [{ metadataBadgeRenderer: { style: 'BADGE_STYLE_TYPE_LIVE_NOW', label: 'LIVE' } }] } : {}),
  },
});

const searchPage = (items: unknown[], continuation?: string) => ({
  contents: {
    twoColumnSearchResultsRenderer: {
      primaryContents: {
        sectionListRenderer: {
          contents: [
            { itemSectionRenderer: { contents: items } },
            ...(continuation ? [{ continuationItemRenderer: { continuationEndpoint: { continuationCommand: { token: continuation } } } }] : []),
          ],
        },
      },
    },
  },
});

const panelVideo = (id: string, title: string, channel: string, length?: string) => ({
  playlistPanelVideoRenderer: {
    videoId: id,
    title: { simpleText: title },
    shortBylineText: { runs: [{ text: channel }] },
    ...(length ? { lengthText: { simpleText: length } } : {}),
  },
});

const mixPage = (items: unknown[]) => ({
  contents: { twoColumnWatchNextResults: { playlist: { playlist: { contents: items } } } },
});

type Call = { url: string; body: any };

/** Replaces global fetch with a scripted InnerTube. */
function fakeYouTube(responses: unknown[] | ((call: Call) => unknown)) {
  const calls: Call[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    const call = { url: String(url), body: JSON.parse(String(init?.body ?? '{}')) };
    calls.push(call);
    const payload = typeof responses === 'function' ? responses(call) : responses.shift();
    if (payload instanceof Error) throw payload;
    if (payload === 500) return new Response('boom', { status: 500 });
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  return { calls, restore: () => { globalThis.fetch = original; } };
}

describe('parseClock', () => {
  it('parses m:ss and h:mm:ss', () => {
    expect(parseClock('3:31')).to.equal(211);
    expect(parseClock('1:02:03')).to.equal(3723);
  });
  it('returns 0 for missing or non-clock text', () => {
    expect(parseClock(undefined)).to.equal(0);
    expect(parseClock('LIVE')).to.equal(0);
    expect(parseClock('')).to.equal(0);
  });
});

describe('innertube.search', () => {
  let fake: ReturnType<typeof fakeYouTube>;
  afterEach(() => fake?.restore());

  it('maps video results and asks for videos only', async () => {
    fake = fakeYouTube([searchPage([
      videoRenderer('aaaaaaaaaaa', 'Shakira - Waka Waka', 'Shakira', '3:31'),
      { shelfRenderer: {} },
      videoRenderer('bbbbbbbbbbb', 'Some Live Radio', 'Radio', undefined, true),
    ])]);
    const out = await innertube.search('waka waka', 10);
    expect(out).to.deep.equal([
      { id: 'aaaaaaaaaaa', title: 'Shakira - Waka Waka', channel: 'Shakira', duration: 211, live: false },
      { id: 'bbbbbbbbbbb', title: 'Some Live Radio', channel: 'Radio', duration: 0, live: true },
    ]);
    expect(fake.calls[0].url).to.contain('/youtubei/v1/search');
    expect(fake.calls[0].body.query).to.equal('waka waka');
    expect(fake.calls[0].body.params).to.equal('EgIQAQ==');
  });

  it('follows one continuation page when the first one is too short', async () => {
    fake = fakeYouTube([
      searchPage([videoRenderer('aaaaaaaaaaa', 'A', 'X', '3:00')], 'TOKEN-2'),
      searchPage([videoRenderer('bbbbbbbbbbb', 'B', 'Y', '3:00'), videoRenderer('ccccccccccc', 'C', 'Z', '3:00')]),
    ]);
    const out = await innertube.search('q', 2);
    expect(out.map((v) => v.id)).to.deep.equal(['aaaaaaaaaaa', 'bbbbbbbbbbb']);
    expect(fake.calls[1].body.continuation).to.equal('TOKEN-2');
  });

  it('throws on HTTP errors so callers can fall back to yt-dlp', async () => {
    fake = fakeYouTube([500]);
    let error: Error | null = null;
    try { await innertube.search('q', 5); } catch (err) { error = err as Error; }
    expect(error?.message).to.match(/HTTP 500/);
  });
});

describe('innertube.mix', () => {
  let fake: ReturnType<typeof fakeYouTube>;
  afterEach(() => fake?.restore());

  it('reads the RD playlist of a video', async () => {
    fake = fakeYouTube([mixPage([panelVideo('aaaaaaaaaaa', 'Seed', 'X', '3:00'), panelVideo('bbbbbbbbbbb', 'Next', 'Y', '4:10')])]);
    const out = await innertube.mix('aaaaaaaaaaa');
    expect(out.map((v) => [v.id, v.duration])).to.deep.equal([['aaaaaaaaaaa', 180], ['bbbbbbbbbbb', 250]]);
    expect(fake.calls[0].body).to.include({ videoId: 'aaaaaaaaaaa', playlistId: 'RDaaaaaaaaaaa' });
  });
});

describe('youtube service on top of InnerTube', () => {
  let fake: ReturnType<typeof fakeYouTube>;
  afterEach(() => fake?.restore());

  it('search cleans titles, drops non-songs and duplicates', async () => {
    fake = fakeYouTube(() => searchPage([
      videoRenderer('aaaaaaaaaaa', 'Mahaleo - Vololona (Official Video)', 'Mahaleo', '3:10'),
      videoRenderer('aaaaaaaaaaa', 'Mahaleo - Vololona (Official Video)', 'Mahaleo', '3:10'),
      videoRenderer('bbbbbbbbbbb', 'Mahaleo Full Album 2 hours', 'Fan', '2:01:00'),
      videoRenderer('ccccccccccc', 'Mahaleo live radio', 'Radio', undefined, true),
    ]));
    const songs = await youtube.search('unit-test mahaleo vololona', 10);
    expect(songs).to.deep.equal([{ id: 'aaaaaaaaaaa', title: 'Vololona', artist: 'Mahaleo', duration: 190 }]);
  });

  it('mix leaves out the seed video', async () => {
    fake = fakeYouTube(() => mixPage([
      panelVideo('ddddddddddd', 'Seed - Song', 'Seed', '3:00'),
      panelVideo('eeeeeeeeeee', 'Other Artist - Other Song', 'Other Artist', '3:30'),
    ]));
    const songs = await youtube.mix('ddddddddddd', 10);
    expect(songs.map((s) => s.id)).to.deep.equal(['eeeeeeeeeee']);
  });
});
