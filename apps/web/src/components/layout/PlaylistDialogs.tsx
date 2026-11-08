import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAddToPlaylist, usePlaylists } from '../../hooks/library';
import { api } from '../../lib/api';
import { pluralize } from '../../lib/format';
import type { Song } from '../../lib/types';
import { toast, useUiStore } from '../../stores/ui';
import { Button } from '../ui/Button';
import { Mosaic } from '../ui/Cover';
import { Skeleton } from '../ui/Feedback';
import { Modal } from '../ui/Modal';

export function CreatePlaylistDialog({
  open,
  onClose,
  initialSongs,
  initialName = '',
  aiPrompt,
  description: initialDescription = '',
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  initialSongs?: Song[];
  initialName?: string;
  aiPrompt?: string;
  description?: string;
  onCreated?: (id: string) => void;
}) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    if (open) { setName(initialName); setDescription(initialDescription); setError(null); }
  }, [open, initialName, initialDescription]);

  const create = useMutation({
    mutationFn: () => api.playlists.create({ name, description, aiPrompt, songs: initialSongs }),
    onSuccess: ({ id }) => {
      qc.invalidateQueries({ queryKey: ['playlists'] });
      qc.invalidateQueries({ queryKey: ['home'] });
      toast(`Playlist « ${name.trim()} » créée`, { tone: 'success' });
      onClose();
      onCreated ? onCreated(id) : navigate(`/playlist/${id}`);
    },
    onError: (err: Error) => setError(err.message),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError('Donne un nom à ta playlist');
    create.mutate();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialSongs?.length ? 'Enregistrer comme playlist' : 'Nouvelle playlist'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button variant="primary" type="submit" form="create-playlist" loading={create.isPending}>Créer</Button>
        </>
      }
    >
      <form id="create-playlist" onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="pl-name" className="mb-1.5 block text-sm font-semibold">Nom</label>
          <input
            id="pl-name"
            value={name}
            onChange={(e) => { setName(e.target.value); setError(null); }}
            maxLength={120}
            placeholder="Ma playlist"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'pl-error' : undefined}
            className="h-12 w-full rounded-xl border border-line-strong bg-fg/[0.04] px-4 text-base outline-none transition focus:border-accent"
          />
          {error && <p id="pl-error" role="alert" className="mt-1.5 text-sm text-danger">{error}</p>}
        </div>
        <div>
          <label htmlFor="pl-desc" className="mb-1.5 block text-sm font-semibold">
            Description <span className="font-normal text-fg-3">(facultatif)</span>
          </label>
          <textarea
            id="pl-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            rows={3}
            className="w-full resize-none rounded-xl border border-line-strong bg-fg/[0.04] px-4 py-3 text-base outline-none transition focus:border-accent"
          />
        </div>
        {initialSongs?.length ? <p className="text-sm text-fg-2">{pluralize(initialSongs.length, 'titre')} seront ajoutés.</p> : null}
      </form>
    </Modal>
  );
}

export function AddToPlaylistDialog() {
  const songs = useUiStore((s) => s.addToPlaylist);
  const close = useUiStore((s) => s.closeAddToPlaylist);
  const { data: playlists, isLoading } = usePlaylists();
  const add = useAddToPlaylist();
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  if (creating && songs) {
    return (
      <CreatePlaylistDialog
        open
        onClose={() => { setCreating(false); close(); }}
        initialSongs={songs}
        initialName={songs.length === 1 ? songs[0].title : ''}
        onCreated={(id) => { setCreating(false); close(); navigate(`/playlist/${id}`); }}
      />
    );
  }

  return (
    <Modal open={Boolean(songs)} onClose={close} title="Ajouter à une playlist">
      <ul className="-mx-2 space-y-1 pb-2">
        <li>
          <button onClick={() => setCreating(true)} className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-fg/[0.06]">
            <span className="grid size-12 place-items-center rounded-lg bg-fg/[0.08]"><Plus className="size-5" aria-hidden /></span>
            <span className="font-semibold">Nouvelle playlist</span>
          </button>
        </li>
        {isLoading && [0, 1, 2].map((i) => <li key={i} className="flex items-center gap-3 p-2"><Skeleton className="size-12" /><Skeleton className="h-4 w-1/2" /></li>)}
        {playlists?.map((p) => (
          <li key={p.id}>
            <button
              disabled={add.isPending}
              onClick={() => { if (songs) add.mutate({ playlistId: p.id, songs, name: p.name }, { onSuccess: close }); }}
              className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-fg/[0.06] disabled:opacity-50"
            >
              <Mosaic ids={p.coverIds} className="size-12" rounded="rounded-lg" />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 truncate font-semibold">
                  {p.name}
                  {p.aiPrompt && <Sparkles className="size-3.5 shrink-0 text-accent-fg" aria-label="Créée par l'IA" />}
                </span>
                <span className="block text-xs text-fg-3">{pluralize(p.songCount, 'titre')}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
