/**
 * Decides whether a YouTube result is an actual song — not a film, a radio
 * drama, a TV sketch, a full album, a concert or a compilation.
 *
 * Deterministic on purpose: it runs on every search result, and the free AI
 * tier (≈50 requests/day) could not afford one LLM call per search.
 * AI-curated lists don't need it: the AI only names real songs.
 */

export interface Candidate {
  title: string;
  channel: string;
  duration: number;
}

export const SONG_MIN_SECONDS = 60;
export const SONG_MAX_SECONDS = 10 * 60;

/** Never songs, whatever the duration. FR / EN / MG vocabulary. */
const NOT_A_SONG = new RegExp(
  [
    'sarimihetsika', 'sary mihetsika', 'tantara', 'fizarana', 'tantaran',
    'film', 'movie', 'téléfilm', 'telefilm', 'cinéma', 'cinema', 'court[- ]métrage', 'long[- ]métrage',
    'épisode', 'episode', '\\bep\\.? ?\\d', 'saison', 'season', '\\bpart(ie)? ?\\d',
    'documentaire', 'documentary', 'reportage', 'interview', 'podcast', 'émission', 'emission',
    'journal', 'actualité', '\\bnews\\b', 'débat', 'conférence', 'conference', 'prédication', 'toriteny',
    'trailer', 'bande[- ]annonce', 'teaser', 'making[- ]of', 'behind the scenes', 'coulisses',
    'reaction', 'réaction', 'tutorial', 'tuto', 'how to', 'cours de', 'leçon', 'unboxing', 'vlog',
    'sketch', 'comédie', 'comedy', 'humour', 'prank', 'spot publicitaire', 'publicité', '\\bspot\\b',
    'full album', 'album complet', 'full live', 'concert (complet|intégral|entier)', 'full concert', 'live stream', 'livestream',
    'compilation', '\\bmix\\b', 'megamix', 'mégamix', 'non[- ]?stop', 'best of', 'playlist',
    '\\d+ ?(hours?|heures?|h)\\b', '1 ?hour', 'heure de',
    'audiobook', 'livre audio', 'asmr', 'white noise', 'bruit blanc',
  ].join('|'),
  'i',
);

/** Strong hints that this is a music track. */
const SONG_SIGNALS = /official (music )?(video|audio|clip|lyric)|clip officiel|vidéo officielle|audio officiel|lyrics?|paroles|tononkira|\bclip\b|\baudio\b|\bremix\b|\bcover\b|feat\.?|\bft\.?\b|prod\.?|music video|visualizer|\bsingle\b/i;

/** Channels that mostly publish non-music content. */
const NON_MUSIC_CHANNEL = /\b(web ?tv|tv|télé|tele|radio|news|info|actu|studio entertainment|films?|cinema|ciné|sketch|comedy|humour|église|eglise|fiangonana)\b/i;

export function songScore(c: Candidate): number {
  const text = `${c.title} ${c.channel}`;
  let score = 0;
  if (SONG_SIGNALS.test(c.title)) score += 2;
  if (/ - Topic$/i.test(c.channel)) score += 3; // YouTube auto-generated artist channels: always songs
  if (/vevo/i.test(c.channel)) score += 3;
  if (/^[^-–—|]{2,40}\s[-–—]\s[^-–—|]{2,80}$/.test(c.title.trim())) score += 1; // "Artist - Title"
  if (NON_MUSIC_CHANNEL.test(c.channel)) score -= 2;
  if (/[!?]{2,}|😂|🤣|🫣/.test(text)) score -= 1;
  return score;
}

export function isLikelySong(c: Candidate): boolean {
  // Unknown duration (rare in search) is allowed; everything else must fit a song.
  if (c.duration && (c.duration < SONG_MIN_SECONDS || c.duration > SONG_MAX_SECONDS)) return false;
  if (NOT_A_SONG.test(c.title)) return false;
  return songScore(c) >= 0;
}
