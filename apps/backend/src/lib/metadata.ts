/**
 * Turns a raw YouTube title + channel into a clean "title — artist".
 *
 * Uploads follow no convention ("Artist - Title (Official Video)", "Title |
 * channel promo", "ARTIST   TITLE   [CLIP GASY]", "Artist- Title"…), so this is
 * a set of heuristics, each pinned by a real example in tests/metadata.test.ts.
 */

/** Marketing words removed wherever they appear (word-bounded: "Mahdi" keeps its "hd"). */
const NOISE = [
  /\b(?:official|officiel(?:le)?)\s*(?:music\s*|lyrics?\s*)?(?:video|vid[ée]o|audio|clip)\b/gi,
  /\bclip\s*officiel(?:le)?\b/gi,
  /\b(?:music|lyrics?)\s*video\b/gi,
  /\baudio\s*(?:official|only)\b/gi,
  /\bvisuali[sz]er\b/gi,
  /\b(?:4k|hd|hq)\b/gi,
  /\bremaster(?:ed)?\b/gi,
  /\bexplicit\b/gi,
  // Malagasy uploads: "Nouveauté Clip Gasy 2012", "NEW GASY", "[ CLIP GASY ]"
  /\b(?:nouveaut[ée]s?|new)\s*(?:clip\s*)?gasy(?:\s*\d{4})?\b/gi,
  /\bclip\s*gasy(?:\s*\d{4})?\b/gi,
  // "Vololona Lyrics", "… tononkira" (Malagasy for lyrics): only at the end, "Paroles" can be a title.
  /\s(?:lyrics?|tononkira)\s*$/gi,
];

/** Everything after these is channel promotion: "Song | PREMIUM MUSIC", "Song // Nouveauté 2012". */
const cutTrailers = (s: string) => s.replace(/\s*\|.*$/, '').replace(/\s*\/\/.*$/, '');

/** "A - B" with spaces on at least one side of the dash, so "Rim-Ka" stays one name. */
const DASH = /^\s*(.+?)(?:\s+[—–\-~]+\s*|\s*[—–\-~]+\s+)(.+?)\s*$/;
const BY = /^(.+?)\s+by\s+(.+?)$/i;
/** "ft. X" up to a wide gap, a dash or a closing bracket. Run on raw text (it needs the double spaces). */
const FEAT = /\s*[([]?\b(?:feat\.?|ft\.?)\s+(.+?)(?=\s{2,}|\s[—–-]\s|[)\]]|$)[)\]]?/i;
const WITH = /\s*\(with\s+([^)]+)\)/i;
const LIVE = /\s+live(?:\s*@.*)?$/i;

function clean(raw: string): string {
  let s = raw.replace(/^\s*\d{1,2}\s*[.\-)]?\s+(?=\D)/, ''); // leading track numbers: "09 Nosy Milalao"
  s = cutTrailers(s);
  // Brackets first, so "(Clip Officiel par X)" goes as a whole instead of leaving "par X)".
  s = s.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s*\[[^\]]*\]\s*/g, ' ');
  s = s.replace(/[()[\]]/g, ' ');
  s = NOISE.reduce((t, p) => t.replace(p, ' '), s);
  s = s.replace(/\s+/g, ' ').trim();
  s = s.replace(/^[-–—~:\s]+|[-–—~:\s]+$/g, '').trim();
  return s || raw.trim();
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const words = (s: string) => (s ? s.split(' ').length : 0);
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * True when `side` is (part of) the name the user typed. A side that merely
 * contains a query word is not enough: searching "tsapiky" must not turn the
 * title "Asio tsapiky amzay" into an artist.
 */
function matchesHint(side: string, hint?: string) {
  if (!hint) return false;
  const a = norm(side), q = norm(hint);
  if (a.length < 2 || q.length < 2) return false;
  return q.includes(a) || (a.includes(q) && words(a) <= words(q) + 1);
}

const GENRE_WORDS = new Set([
  'salegy', 'tsapiky', 'kilalaky', 'basesa', 'beko', 'vakodrazana', 'hira', 'gasy', 'malagasy', 'madagascar', 'mozika',
  'afro', 'afrobeat', 'afrobeats', 'amapiano', 'rap', 'hip', 'hop', 'rnb', 'zouk', 'reggae', 'dancehall', 'gospel',
  'music', 'musique', 'mix', 'hits', 'best', 'top', 'new', 'nouveaute', 'clip', 'remix', 'live', 'chanson', 'song',
]);

/** Channel names often carry a suffix: "Ninie Doniah Officiel", "WizkidVEVO", "X - Topic". */
const cleanChannel = (ch: string) =>
  ch.replace(/\s*-\s*Topic$/i, '').replace(/vevo.*$/i, '').replace(/[\s-]*(?:official|officiel|offical)\s*$/i, '').trim() || ch.trim();

/** "VAIAVY CHILA" → "Vaiavy Chila"; short tokens (DJ, MJ) and tokens with digits stay as they are. */
function unshout(s: string): string {
  const letters = s.replace(/[^\p{L}]/gu, '');
  if (letters.length < 4 || letters !== letters.toUpperCase()) return s;
  return s.replace(/[\p{L}\d'’]+/gu, (w) => (w.length <= 2 || /\d/.test(w) ? w : w[0] + w.slice(1).toLowerCase()));
}

/** Removes the artist's name when it is repeated at the start or end of the title. */
function stripArtist(title: string, artist: string): string {
  if (artist.length < 2) return title;
  const re = new RegExp(`^${escapeRe(artist)}\\s+|\\s+${escapeRe(artist)}$`, 'i');
  const out = title.replace(re, '').trim();
  return out.length >= 2 ? out : title;
}

/** Pulls "ft. X" out of a raw piece of title. */
function takeFeats(raw: string): { rest: string; feats: string[] } {
  const feats: string[] = [];
  let rest = raw;
  for (const re of [FEAT, WITH]) {
    const m = rest.match(re);
    if (m) {
      feats.push(m[1].trim());
      rest = rest.replace(m[0], '  ');
    }
  }
  return { rest, feats };
}

/**
 * `hint` is the user's search query: when one side of "A - B" (or the start of
 * a title without separator) matches it, that is the artist.
 */
export function extractMetadata(rawTitle: string, channelName: string, hint?: string): { title: string; artist: string } {
  const channel = cleanChannel(channelName);
  const raw = cutTrailers(rawTitle);
  let artist = channel;
  let titleRaw = raw;

  const dash = raw.match(DASH);
  const hintWords = hint ? norm(hint).split(' ').filter(Boolean) : [];
  // A genre search ("tsapiky", "salegy 2025") names no artist.
  const hintIsName = hintWords.length > 0 && !hintWords.some((w) => GENRE_WORDS.has(w) || /^\d+$/.test(w));
  const leading = hintIsName
    ? raw.match(new RegExp(`^\\s*(${hintWords.map(escapeRe).join('\\s+')})\\s+(.+)$`, 'i'))
    : null;

  if (dash) {
    const [left, right] = [dash[1].trim(), dash[2].trim()];
    const leftClean = clean(left), rightClean = clean(right);
    const ch = channel.toLowerCase();
    const leftHasChannel = ch.includes(leftClean.toLowerCase()) || leftClean.toLowerCase().includes(ch) || ch.includes(leftClean.toLowerCase().split(' ')[0]);
    const rightHasChannel = ch.includes(rightClean.toLowerCase()) || rightClean.toLowerCase().includes(ch);
    const leftHint = matchesHint(leftClean, hint), rightHint = matchesHint(rightClean, hint);

    let artistIsLeft: boolean;
    if (rightHint && !leftHint) artistIsLeft = false;
    else if (leftHint && !rightHint) artistIsLeft = true;
    else if (leftHasChannel) artistIsLeft = true;
    else if (rightHasChannel) artistIsLeft = false;
    else artistIsLeft = !(leftClean.length >= 30 && rightClean.length < 30);

    artist = artistIsLeft ? leftClean : rightClean;
    titleRaw = artistIsLeft ? right : left;
  } else if (leading) {
    // "Vaiavy Chila Garamaso" uploaded by a fan channel: the searched artist leads the title.
    artist = leading[1].trim();
    titleRaw = leading[2];
  } else {
    const by = raw.match(BY);
    if (by) {
      titleRaw = by[1];
      artist = by[2].replace(/\s+\d{4}\s*$/, '').trim();
    }
  }

  const { rest, feats } = takeFeats(titleRaw);
  let title = clean(rest);
  const live = LIVE.test(title);
  if (live) title = title.replace(LIVE, '').trim();
  title = stripArtist(title, artist);

  artist = unshout(artist.replace(/\s+/g, ' ').replace(/[-–—]+$/g, '').trim());
  if (artist.length < 2) artist = unshout(channel);
  const featNames = feats.map((f) => unshout(f.replace(/\s+/g, ' ')))
    .filter((f) => f && !artist.toLowerCase().includes(f.toLowerCase()));
  if (featNames.length) artist = `${artist}, ${featNames.join(', ')}`;

  title = unshout(title.replace(/[-–—]+$/g, '').trim());
  if (title.length < 2) title = clean(rawTitle);
  if (live) title = `${title} (Live)`;

  return { title: title.substring(0, 100), artist: artist.substring(0, 60) };
}

const GENRE_KEYWORDS: { patterns: RegExp[]; genre: string }[] = [
  { patterns: [/naruto/i, /anime/i, /opening/i, /shippuden/i, /otaku/i, /manga/i, /jpop/i, /j.?rock/i, /kawaii/i], genre: 'anime' },
  { patterns: [/rap/i, /hip.?hop/i, /trap/i, /drill/i, /grime/i, /freestyle/i, /beats/i], genre: 'hip hop' },
  { patterns: [/rock/i, /metal/i, /punk/i, /grunge/i, /alternative/i, /indie/i, /hardcore/i], genre: 'rock' },
  { patterns: [/rnb/i, /r&b/i, /soul/i, /neo.?soul/i, /rhythm/, /blues/i], genre: 'rnb' },
  { patterns: [/electronic/i, /edm/i, /house/i, /techno/i, /trance/i, /dubstep/i, /drum.?n.?bass/i, /dnb/i], genre: 'electronic' },
  { patterns: [/jazz/i, /swing/i, /bebop/i, /fusion/i], genre: 'jazz' },
  { patterns: [/classical/i, /orchestra/i, /symphony/i, /piano/i, /instrumental/i], genre: 'classical' },
  { patterns: [/lo.?fi/i, /lofi/i, /chillhop/i, /chill/i, /ambient/i, /relax/i, /calm/i, /sleep/i, /meditation/i], genre: 'chill' },
  { patterns: [/afrobeat/i, /afro/i, /amapiano/i, /highlife/i], genre: 'afro' },
  { patterns: [/reggae/i, /dancehall/i, /ska/i, /reggaeton/i], genre: 'reggae' },
  { patterns: [/latin/i, /salsa/i, /bachata/i, /merengue/i, /cumbia/i, /dembow/i], genre: 'latino' },
  { patterns: [/pop/i, /top.?40/i, /hits/i, /charts/i], genre: 'pop' },
  { patterns: [/k.?pop/i, /kpop/i], genre: 'k-pop' },
  { patterns: [/country/i, /folk/i, /bluegrass/i], genre: 'country' },
  { patterns: [/gospel/i, /christian/i, /worship/i], genre: 'gospel' },
  { patterns: [/soundtrack/i, /ost/i, /score/i, /theme/i, /bgm/i], genre: 'soundtrack' },
];

export function detectGenre(title: string, artist: string): string {
  const combined = `${title} ${artist}`;
  for (const entry of GENRE_KEYWORDS) {
    for (const pattern of entry.patterns) {
      if (pattern.test(combined)) return entry.genre;
    }
  }
  return '';
}

export function relatedSearchQuery(title: string, artist: string, genre: string): string {
  if (genre) {
    const genreQueries: Record<string, string> = {
      anime: 'anime openings and ost mix',
      'hip hop': 'hip hop rap music mix',
      rock: 'rock music mix',
      rnb: 'rnb soul mix',
      electronic: 'electronic dance music mix',
      jazz: 'jazz music mix',
      classical: 'classical music mix',
      chill: 'chill lofi beats mix',
      afro: 'afrobeat african music mix',
      reggae: 'reggae dancehall mix',
      latino: 'latin music salsa mix',
      pop: 'pop hits music mix',
      'k-pop': 'kpop music mix',
      country: 'country music mix',
      gospel: 'gospel music mix',
      soundtrack: 'movie soundtrack ost mix',
    };
    return genreQueries[genre] || `${genre} music mix`;
  }

  const mainArtist = artist.split(/[,&]/)[0].trim();
  const titleShort = title.split(/[(\[]/)[0].trim();
  return `${mainArtist} ${titleShort} music`.trim();
}