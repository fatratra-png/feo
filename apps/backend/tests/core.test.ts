import { expect } from 'chai';
import { TTLCache, limiter } from '../src/lib/cache';
import { extractMetadata } from '../src/lib/metadata';
import { diversify } from '../src/services/ai';
import { mainArtist } from '../src/services/library';
import { extractJson, orderModels } from '../src/services/llm';
import { pickBestMatch } from '../src/services/youtube';
import { parseRange } from '../src/routes';

const song = (id: string, title: string, artist: string, duration = 200) => ({ id, title, artist, duration });

describe('extractJson', () => {
  it('parses plain JSON', () => expect(extractJson('{"a":1}')).to.deep.equal({ a: 1 }));
  it('strips code fences and think blocks', () => {
    expect(extractJson('<think>hmm</think>\n```json\n{"songs":[]}\n```')).to.deep.equal({ songs: [] });
  });
  it('finds JSON surrounded by prose', () => {
    expect(extractJson('Voici la liste : {"x":[1,2]} Bonne écoute !')).to.deep.equal({ x: [1, 2] });
  });
  it('throws when there is no JSON', () => expect(() => extractJson('désolé')).to.throw());
});

describe('orderModels (adaptive routing)', () => {
  const models = ['slow-reasoner', 'mid', 'fast-a', 'fast-b'];
  it('keeps configured order for quality work', () => {
    expect(orderModels(models, 'quality', ['fast-a'])).to.deep.equal(models);
  });
  it('tries hinted fast models first, then the mid tier, for interactive work', () => {
    expect(orderModels(models, 'fast', ['fast-a', 'fast-b'], ['mid'])).to.deep.equal(['fast-a', 'fast-b', 'mid', 'slow-reasoner']);
  });
});

describe('pickBestMatch', () => {
  it('prefers the matching artist + title over a higher-ranked cover', () => {
    const candidates = [
      song('aaaaaaaaaaa', 'Waka Waka (Karaoke Version)', 'Sing King'),
      song('bbbbbbbbbbb', 'Waka Waka (This Time for Africa)', 'Shakira'),
    ];
    expect(pickBestMatch(candidates, 'Waka Waka', 'Shakira')?.id).to.equal('bbbbbbbbbbb');
  });
  it('refuses results where the artist does not appear (prevents mislabelling)', () => {
    expect(pickBestMatch([song('ccccccccccc', 'Fitiavana', 'Someone Else')], 'Fitiavana', 'Lalao')).to.equal(null);
  });
  it('rejects hour-long compilations', () => {
    const r = pickBestMatch([song('ddddddddddd', 'Mahaleo best of', 'Mahaleo', 3600), song('eeeeeeeeeee', 'Dihy', 'Mahaleo', 240)], 'Dihy', 'Mahaleo');
    expect(r?.id).to.equal('eeeeeeeeeee');
  });
});

describe('diversify', () => {
  it('caps songs per main artist', () => {
    const list = ['a', 'b', 'c', 'd'].map((x, i) => song(x.repeat(11), `T${i}`, i < 3 ? 'Mahaleo, Dama' : 'Jaojoby'));
    expect(diversify(list, 2).map((s) => s.title)).to.deep.equal(['T0', 'T1', 'T3']);
  });
  it('mainArtist strips featurings', () => expect(mainArtist('Wizkid feat. Tems')).to.equal('Wizkid'));
});

describe('parseRange', () => {
  it('defaults to the whole file', () => expect(parseRange(undefined, 100)).to.deep.equal({ start: 0, end: 99 }));
  it('handles open-ended ranges (what browsers send first)', () => expect(parseRange('bytes=0-', 100)).to.deep.equal({ start: 0, end: 99 }));
  it('clamps the end to the file size', () => expect(parseRange('bytes=10-500', 100)).to.deep.equal({ start: 10, end: 99 }));
  it('supports suffix ranges', () => expect(parseRange('bytes=-20', 100)).to.deep.equal({ start: 80, end: 99 }));
  it('rejects unsatisfiable ranges', () => expect(parseRange('bytes=200-', 100)).to.equal(null));
});

describe('TTLCache', () => {
  it('computes once under concurrent calls', async () => {
    const cache = new TTLCache<number>(1000);
    let calls = 0;
    const fn = async () => { calls++; await new Promise((r) => setTimeout(r, 20)); return 42; };
    const [a, b] = await Promise.all([cache.wrap('k', fn), cache.wrap('k', fn)]);
    expect([a, b, calls]).to.deep.equal([42, 42, 1]);
  });
  it('evicts the least recently used entry', () => {
    const cache = new TTLCache<number>(1000, 2);
    cache.set('a', 1); cache.set('b', 2); cache.get('a'); cache.set('c', 3);
    expect([cache.get('a'), cache.get('b'), cache.get('c')]).to.deep.equal([1, undefined, 3]);
  });
});

describe('limiter', () => {
  it('never runs more than N tasks at once', async () => {
    const limit = limiter(2);
    let active = 0, peak = 0;
    await Promise.all(Array.from({ length: 6 }, () => limit(async () => {
      active++; peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 10));
      active--;
    })));
    expect(peak).to.equal(2);
  });
});

describe('extractMetadata', () => {
  it('splits "Artist - Title (Official Video)"', () => {
    expect(extractMetadata('Wizkid - Essence (Official Video) ft. Tems', 'WizkidVEVO')).to.deep.equal({ title: 'Essence', artist: 'Wizkid, Tems' });
  });
  it('drops leading track numbers', () => {
    expect(extractMetadata('09 Nosy Milalao - Dama Mahaleo', 'Hira Gasy').title).to.not.match(/^09/);
  });
});

import { isLikelySong } from '../src/lib/songFilter';

describe('isLikelySong', () => {
  const c = (title: string, channel: string, duration: number) => ({ title, channel, duration });
  it('keeps real songs', () => {
    expect(isLikelySong(c('Dadi Love - Tsikirikitry ( Clip Officiel )', 'Dadi Love', 259))).to.equal(true);
    expect(isLikelySong(c('Mbarakaly', 'Rossy - Topic', 270))).to.equal(true);
    expect(isLikelySong(c('Rafahafahana', 'Mahaleo official', 303))).to.equal(true);
    expect(isLikelySong(c('Rossy - Mahatsiaro anao (tononkira)', 'Li.', 212))).to.equal(true);
  });
  it('drops films and radio dramas', () => {
    expect(isLikelySong(c('Sarimihetsika Jesosy | Malagasy | Jesus Film', 'Jesus.net', 7667))).to.equal(false);
    expect(isLikelySong(c("Tantara Malagasy - SIAKAN'ANDRIANA", 'SARY MIHETSIKA / Web TV', 5896))).to.equal(false);
  });
  it('drops TV sketches even when short', () => {
    expect(isLikelySong(c('Mba Lait : Ny vava no tsy atao be 🫣', 'SARY MIHETSIKA / Web TV', 158))).to.equal(false);
  });
  it('drops full albums, concerts, compilations and ads', () => {
    expect(isLikelySong(c('Madagascar by Mahaleo (Full Album - Audio)', 'Hira Gasy', 2144))).to.equal(false);
    expect(isLikelySong(c('ROSSY - Full Live Performance (MAKUA FESTIVAL)', 'HIRA TIAKO', 8897))).to.equal(false);
    expect(isLikelySong(c('Afro mix 2026 nonstop', 'DJ X', 540))).to.equal(false);
    expect(isLikelySong(c('SPOT MADAGASCAR SANDAL 2018', 'UNICEF Madagascar', 40))).to.equal(false);
  });
});

describe('extractMetadata with query hint', () => {
  it('uses the search query to find which side is the artist', () => {
    expect(extractMetadata('Hody amin i ramalala - Rossy (lyrics)', "Doom's harmony", 'Rossy')).to.deep.equal({ title: 'Hody amin i ramalala', artist: 'Rossy' });
  });
  it('keeps hyphenated names intact', () => {
    expect(extractMetadata('Rim-Ka - GLITA (Official Video Music)', 'Rim-ka').artist).to.equal('Rim-Ka');
  });
});

import { isBotCheck } from '../src/services/youtube';

describe('isBotCheck', () => {
  it('recognises YouTube anti-bot challenges', () => {
    expect(isBotCheck('ERROR: [youtube] abc: Sign in to confirm you’re not a bot. This helps protect our community.')).to.equal(true);
    expect(isBotCheck('HTTP Error 429: Too Many Requests')).to.equal(true);
  });
  it('ignores ordinary failures', () => {
    expect(isBotCheck('ERROR: [youtube] abc: Video unavailable')).to.equal(false);
  });
});

describe('TTLCache.swr (stale-while-revalidate)', () => {
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  it('serves a stale value at once and refreshes it in the background', async () => {
    const cache = new TTLCache<number>(20);
    let n = 0;
    const fn = async () => { await wait(30); return ++n; };
    expect(await cache.swr('k', fn, 1000)).to.equal(1);   // cold: waits
    await wait(25);                                      // now expired, but within the stale window
    const t = Date.now();
    expect(await cache.swr('k', fn, 1000)).to.equal(1);   // stale, returned instantly
    expect(Date.now() - t).to.be.below(15);
    await wait(40);
    expect(await cache.swr('k', fn, 1000)).to.equal(2);   // refreshed value
  });
  it('keeps the stale value when the refresh fails', async () => {
    const cache = new TTLCache<string>(10);
    await cache.swr('k', async () => 'ok', 1000);
    await wait(15);
    expect(await cache.swr('k', async () => { throw new Error('down'); }, 1000)).to.equal('ok');
    await wait(5);
    expect(await cache.swr('k', async () => 'later', 1000)).to.equal('ok');
  });
  it('waits for a fresh value once past the stale window', async () => {
    const cache = new TTLCache<string>(5);
    await cache.swr('k', async () => 'old', 5);
    await wait(15);
    expect(await cache.swr('k', async () => 'new', 5)).to.equal('new');
  });
});
