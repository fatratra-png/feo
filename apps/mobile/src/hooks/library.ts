import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Song } from '../lib/types';
import { toast } from "../stores/ui";

export function useLikedIds() {
  const { data } = useQuery({
    queryKey: ['like-ids'],
    queryFn: async () => new Set((await api.likes.ids()).ids),
    staleTime: 5 * 60_000,
  });
  return data ?? new Set<string>();
}

/** Optimistic like toggle: the heart reacts instantly, rolls back on error. */
export function useToggleLike() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ song, liked }: { song: Song; liked: boolean }) =>
      liked ? api.likes.add(song) : api.likes.remove(song.id),
    onMutate: async ({ song, liked }) => {
      await qc.cancelQueries({ queryKey: ['like-ids'] });
      const prev = qc.getQueryData<Set<string>>(['like-ids']);
      const next = new Set(prev);
      liked ? next.add(song.id) : next.delete(song.id);
      qc.setQueryData(['like-ids'], next);
      return { prev };
    },
    onError: (err: Error, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['like-ids'], ctx.prev);
      toast(err.message, { tone: 'error' });
    },
    onSuccess: (_d, { liked }) => {
      toast(liked ? 'Ajouté à tes titres likés' : 'Retiré de tes titres likés', { tone: liked ? 'success' : 'info' });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['likes'] });
      qc.invalidateQueries({ queryKey: ['home'] });
    },
  });
}

export function usePlaylists() {
  return useQuery({ queryKey: ['playlists'], queryFn: async () => (await api.playlists.list()).playlists });
}

export function useAddToPlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ playlistId, songs }: { playlistId: string; songs: Song[]; name: string }) => api.playlists.addSongs(playlistId, songs),
    onSuccess: (res, { playlistId, songs, name }) => {
      qc.invalidateQueries({ queryKey: ['playlists'] });
      qc.invalidateQueries({ queryKey: ['playlist', playlistId] });
      if (res.added === 0) toast(songs.length > 1 ? 'Ces titres sont déjà dans la playlist' : 'Ce titre est déjà dans la playlist');
      else toast(`${res.added > 1 ? `${res.added} titres ajoutés` : 'Ajouté'} à « ${name} »`, { tone: 'success' });
    },
    onError: (err: Error) => toast(err.message, { tone: 'error' }),
  });
}
