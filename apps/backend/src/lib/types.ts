/** A playable song. `id` is the 11-char YouTube video id. */
export interface Song {
  id: string;
  title: string;
  artist: string;
  duration: number;
}

/** A song suggested by the AI, with the reason it was picked. */
export interface CuratedSong extends Song {
  reason?: string;
}

export const YT_ID = /^[a-zA-Z0-9_-]{11}$/;
