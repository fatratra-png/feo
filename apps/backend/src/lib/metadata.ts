const OFFICIAL_PATTERNS = [
  /\s*\(?official\s*(music\s*)?video\)?\s*/gi,
  /\s*\(?official\s*lyric\s*video\)?\s*/gi,
  /\s*\(?official\s*audio\)?\s*/gi,
  /\s*\(?clip\s*officiel\)?\s*/gi,
  /\s*\(?music\s*video\)?\s*/gi,
  /\s*\(?lyric\s*video\)?\s*/gi,
  /\s*\(?audio\s*official\)?\s*/gi,
  /\s*\(?audio\s*only\)?\s*/gi,
  /\s*\(?visualizer\)?\s*/gi,
  /\s*\(?4k\)?\s*/gi,
  /\s*\(?hd\)?\s*/gi,
  /\s*\(?remastered\)?\s*/gi,
  /\s*\(?remaster\)?\s*/gi,
  /\s*\(?explicit\)?\s*/gi,
  /\s*\[official\s*(music\s*)?video\]\s*/gi,
  /\s*\[official\s*lyric\s*video\]\s*/gi,
  /\s*\[music\s*video\]\s*/gi,
  /\s*\[hd\]\s*/gi,
  /\s*\[4k\]\s*/gi,
  /\s*\|\s*full\s*(hd|song|version).*$/gi,
  /\s*\|.*$/gi,
  /^.*\|\s*/gi,
];

const DASH_SEPARATORS = /^\s*(.+?)\s+[—–\-~|]+\s+(.+?)\s*$/;

const BY_PREFIX = /^(.+?)\s+by\s+(.+?)$/i;

const FEAT_PATTERNS = [
  /\s*\(?feat\.?\s+([^)]+)\)?\s*/gi,
  /\s*\(?ft\.?\s+([^)]+)\)?\s*/gi,
  /\s*\(?with\s+([^)]+)\)?\s*/gi,
  /\s*\[feat\.?\s+([^\]]+)\]\s*/gi,
  /\s*\[ft\.?\s+([^\]]+)\]\s*/gi,
];

function clean(raw: string): string {
  let s = raw.replace(/^\s*\d{1,2}\s*[.\-)]?\s+(?=\D)/, ''); // leading track numbers: "09 Nosy Milalao"

  s = OFFICIAL_PATTERNS.reduce((t, p) => t.replace(p, ''), s);
  s = s.replace(/\s*\([^)]*\)\s*/g, ' ');
  s = s.replace(/\s*\[[^\]]*\]\s*/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  s = s.replace(/^[-–—\s]+|[-–—\s]+$/g, '').trim();
  return s || raw;
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** True when `side` and the user's query clearly refer to the same name. */
function matchesHint(side: string, hint?: string) {
  if (!hint) return false;
  const a = norm(side), q = norm(hint);
  return a.length >= 2 && q.length >= 2 && (q.includes(a) || a.includes(q));
}

/**
 * `hint` is the user's search query: when one side of "A - B" matches it,
 * that side is the artist (fixes "Title - Artist" uploads).
 */
export function extractMetadata(rawTitle: string, channelName: string, hint?: string): { title: string; artist: string } {
  const cleaned = clean(rawTitle);
  let title = cleaned;
  let artist = channelName;

  const chLower = channelName.toLowerCase();

  const dashMatch = rawTitle.match(DASH_SEPARATORS);
  if (dashMatch) {
    const left = dashMatch[1].trim();
    const right = dashMatch[2].trim();
    const leftClean = clean(left);
    const rightClean = clean(right);

    const leftHasChannel = chLower.includes(leftClean.toLowerCase()) || leftClean.toLowerCase().includes(chLower) || chLower.includes(leftClean.toLowerCase().split(' ')[0]);
    const rightHasChannel = chLower.includes(rightClean.toLowerCase()) || rightClean.toLowerCase().includes(chLower);

    const leftHint = matchesHint(leftClean, hint), rightHint = matchesHint(rightClean, hint);

    if (rightHint && !leftHint) {
      title = leftClean;
      artist = rightClean;
    } else if (leftHint && !rightHint) {
      artist = leftClean;
      title = rightClean;
    } else if (leftHasChannel) {
      artist = leftClean;
      title = rightClean;
    } else if (rightHasChannel) {
      title = leftClean;
      artist = rightClean;
    } else if (leftClean.length < 30 && rightClean.length < 60) {
      artist = leftClean;
      title = rightClean;
    } else if (leftClean.length < 60 && rightClean.length < 30) {
      title = leftClean;
      artist = rightClean;
    } else {
      artist = leftClean;
      title = rightClean;
    }
  } else {
    const byMatch = rawTitle.match(BY_PREFIX);
    if (byMatch) {
      title = clean(byMatch[1].trim());
      artist = byMatch[2].trim();
    } else {
      title = clean(rawTitle);
    }
  }

  const feats: string[] = [];
  for (const pattern of FEAT_PATTERNS) {
    let match;
    while ((match = pattern.exec(title)) !== null) {
      feats.push(match[1].trim());
    }
  }
  if (feats.length > 0) {
    title = title.replace(/\s*\(?feat\.?\s+[^)]+\)?\s*/gi, '');
    title = title.replace(/\s*\(?ft\.?\s+[^)]+\)?\s*/gi, '');
    title = title.replace(/\s*\(?with\s+[^)]+\)?\s*/gi, '');
    title = title.replace(/\s*\[feat\.?\s+[^\]]+\]\s*/gi, '');
    title = title.replace(/\s*\[ft\.?\s+[^\]]+\]\s*/gi, '');
    title = title.trim();
    artist = `${artist}, ${feats.join(', ')}`;
  }

  artist = artist.replace(/[-–—]+$/g, '').trim();
  title = title.replace(/[-–—]+$/g, '').trim();

  if (artist.length < 2) artist = channelName;

  artist = artist.replace(/vevo.*$/i, '').replace(/-?official$/i, '').trim();

  if (title.length < 2) title = cleaned;

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