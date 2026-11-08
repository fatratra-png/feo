import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Heart, ListPlus, Pencil, Radio, Shuffle, Sparkles, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CollectionHeader } from '../components/layout/CollectionHeader';
import { CreatePlaylistDialog } from '../components/layout/PlaylistDialogs';
import { usePlayingContext } from '../components/song/Cards';
import { SongList } from '../components/song/SongList';
import { Button, IconButton, PlayButton } from '../components/ui/Button';
import { Mosaic } from '../components/ui/Cover';
import { EmptyState, ErrorState, Skeleton, SongListSkeleton } from '../components/ui/Feedback';
import { Modal } from '../components/ui/Modal';
import { api } from '../lib/api';
import { formatTotal, pluralize, relativeTime } from '../lib/format';
import type { Playlist, Song } from '../lib/types';
import { usePlayerStore, type PlayContext } from '../stores/player';
import { toast, useUiStore } from '../stores/ui';

function HeaderSkeleton() {
  return (
    <div className="flex flex-col items-center gap-6 px-4 pt-10 pb-6 sm:flex-row sm:items-end sm:px-8">
      <Skeleton className="aspect-square w-52 rounded-xl sm:w-56" />
      <div className="w-full flex-1 space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
      </div>
    </div>
  );
}

function PlayActions({ songs, context, extra }: { songs: Song[]; context: PlayContext; extra?: React.ReactNode }) {
  const playing = usePlayingContext(context.label);
  const ctxActive = usePlayerStore((s) => s.context?.label === context.label);
  return (
    <>
      <PlayButton
        size="xl"
        playing={playing}
        label={playing ? 'Pause' : `Lire ${context.label}`}
        onClick={() => (ctxActive ? usePlayerStore.getState().togglePlay() : usePlayerStore.getState().playSongs(songs, 0, context))}
      />
      <IconButton label="Lecture aléatoire" size="lg" disabled={!songs.length} onClick={() => usePlayerStore.getState().playShuffled(songs, context)}>
        <Shuffle className="size-6" />
      </IconButton>
      <IconButton label="Tout ajouter à une playlist" size="lg" disabled={!songs.length} onClick={() => useUiStore.getState().openAddToPlaylist(songs)}>
        <ListPlus className="size-6" />
      </IconButton>
      {extra}
    </>
  );
}

/* ------------------------------------------------------------------ */

export function PlaylistPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { data: pl, isLoading, error, refetch } = useQuery({ queryKey: ['playlist', id], queryFn: () => api.playlists.get(id) });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['playlist', id] });
    qc.invalidateQueries({ queryKey: ['playlists'] });
    qc.invalidateQueries({ queryKey: ['home'] });
  };

  const remove = useMutation({
    mutationFn: ({ song }: { song: Song; index: number }) => api.playlists.removeSong(id, song.id),
    onMutate: ({ song }) => {
      qc.setQueryData<Playlist>(['playlist', id], (p) => (p ? { ...p, songs: p.songs.filter((s) => s.id !== song.id), songCount: p.songCount - 1 } : p));
    },
    onSuccess: (_d, { song }) => {
      invalidate();
      toast(`« ${song.title} » retiré`, {
        action: { label: 'Annuler', run: () => api.playlists.addSongs(id, [song]).then(invalidate) },
      });
    },
    onError: (err: Error) => { toast(err.message, { tone: 'error' }); invalidate(); },
  });

  const reorder = useMutation({
    mutationFn: (songIds: string[]) => api.playlists.reorder(id, songIds),
    onError: (err: Error) => { toast(err.message, { tone: 'error' }); invalidate(); },
    onSuccess: invalidate,
  });

  const move = (from: number, to: number) => {
    if (!pl) return;
    const songs = [...pl.songs];
    const [s] = songs.splice(from, 1);
    songs.splice(to, 0, s);
    qc.setQueryData<Playlist>(['playlist', id], { ...pl, songs });
    reorder.mutate(songs.map((x) => x.id));
  };

  const del = useMutation({
    mutationFn: () => api.playlists.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['playlists'] });
      qc.invalidateQueries({ queryKey: ['home'] });
      toast('Playlist supprimée');
      navigate('/library');
    },
    onError: (err: Error) => toast(err.message, { tone: 'error' }),
  });

  if (error) return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />;
  if (isLoading || !pl) return <><HeaderSkeleton /><div className="px-4 sm:px-8"><SongListSkeleton /></div></>;

  const context = { label: pl.name, href: `/playlist/${pl.id}` };

  return (
    <div className="animate-fade-in">
      <CollectionHeader
        eyebrow={pl.aiPrompt ? <span className="inline-flex items-center gap-1.5"><Sparkles className="size-3.5" aria-hidden /> Playlist créée par l'IA</span> : 'Playlist'}
        title={pl.name}
        description={pl.description || (pl.aiPrompt ? `« ${pl.aiPrompt} »` : undefined)}
        meta={`${pluralize(pl.songCount, 'titre')}${pl.duration ? ` · ${formatTotal(pl.duration)}` : ''} · modifiée ${relativeTime(pl.updatedAt)}`}
        cover={<Mosaic ids={pl.coverIds} className="w-full" />}
        colorFrom={pl.coverIds[0]}
        actions={
          <PlayActions
            songs={pl.songs}
            context={context}
            extra={
              <>
                <IconButton label="Modifier les détails" size="lg" onClick={() => setEditing(true)}><Pencil className="size-5" /></IconButton>
                <IconButton label="Supprimer la playlist" size="lg" onClick={() => setConfirmDelete(true)}><Trash2 className="size-5" /></IconButton>
              </>
            }
          />
        }
      />
      <div className="px-2 pb-6 sm:px-6">
        {pl.songs.length === 0 ? (
          <EmptyState icon={<ListPlus />} title="Cette playlist est vide" action={<Button variant="primary" onClick={() => navigate('/search')}>Chercher des titres</Button>}>
            Ajoute des titres depuis la recherche avec le menu « ⋯ ».
          </EmptyState>
        ) : (
          <>
            <p className="mb-2 hidden px-3 text-xs text-fg-3 sm:block">Astuce : glisse-dépose les titres pour les réordonner.</p>
            <SongList songs={pl.songs} context={context} onRemove={(song, index) => remove.mutate({ song, index })} onMove={move} meta={(s) => <span className="hidden lg:inline">{relativeTime((s as Playlist['songs'][number]).addedAt)}</span>} />
          </>
        )}
      </div>

      <EditPlaylistDialog open={editing} onClose={() => setEditing(false)} playlist={pl} onSaved={invalidate} />
      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Supprimer la playlist ?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Annuler</Button>
            <Button variant="danger" loading={del.isPending} onClick={() => del.mutate()}>Supprimer</Button>
          </>
        }
      >
        <p className="text-sm text-fg-2">« {pl.name} » sera définitivement supprimée. Les titres resteront dans ta bibliothèque s'ils sont likés.</p>
      </Modal>
    </div>
  );
}

function EditPlaylistDialog({ open, onClose, playlist, onSaved }: { open: boolean; onClose: () => void; playlist: Playlist; onSaved: () => void }) {
  const [name, setName] = useState(playlist.name);
  const [description, setDescription] = useState(playlist.description);
  const save = useMutation({
    mutationFn: () => api.playlists.update(playlist.id, { name, description }),
    onSuccess: () => { onSaved(); onClose(); toast('Modifications enregistrées', { tone: 'success' }); },
    onError: (err: Error) => toast(err.message, { tone: 'error' }),
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Modifier la playlist"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button variant="primary" type="submit" form="edit-pl" loading={save.isPending} disabled={!name.trim()}>Enregistrer</Button>
        </>
      }
    >
      <form id="edit-pl" onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
        <div>
          <label htmlFor="edit-name" className="mb-1.5 block text-sm font-semibold">Nom</label>
          <input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className="h-12 w-full rounded-xl border border-line-strong bg-fg/[0.04] px-4 text-base outline-none focus:border-accent" />
        </div>
        <div>
          <label htmlFor="edit-desc" className="mb-1.5 block text-sm font-semibold">Description</label>
          <textarea id="edit-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={500} className="w-full resize-none rounded-xl border border-line-strong bg-fg/[0.04] px-4 py-3 text-base outline-none focus:border-accent" />
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */

export function LikedPage() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['likes'], queryFn: api.likes.list });
  const songs = data?.songs ?? [];
  const context = { label: 'Titres likés', href: '/liked' };
  return (
    <div className="animate-fade-in">
      <CollectionHeader
        eyebrow="Collection"
        title="Titres likés"
        meta={isLoading ? '…' : `${pluralize(songs.length, 'titre')}${songs.length ? ` · ${formatTotal(songs.reduce((n, s) => n + s.duration, 0))}` : ''}`}
        cover={
          <div className="grid aspect-square w-full place-items-center rounded-xl bg-[linear-gradient(135deg,color-mix(in_oklab,var(--accent)_85%,#000),#2a1f5c)]">
            <Heart className="size-1/3 fill-white text-fg" aria-hidden />
          </div>
        }
        actions={songs.length ? <PlayActions songs={songs} context={context} /> : undefined}
      />
      <div className="px-2 pb-6 sm:px-6">
        {error ? (
          <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
        ) : isLoading ? (
          <SongListSkeleton />
        ) : songs.length === 0 ? (
          <EmptyState icon={<Heart />} title="Aucun titre liké pour l'instant" action={<Button variant="primary" onClick={() => navigate('/search')}>Découvrir des titres</Button>}>
            Touche le cœur sur un titre pour le retrouver ici. Tes likes aident aussi l'IA à mieux te connaître.
          </EmptyState>
        ) : (
          <SongList songs={songs} context={context} meta={(s) => <span className="hidden lg:inline">{relativeTime((s as (typeof songs)[number]).likedAt)}</span>} />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function MixPage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const title = params.get('t') ?? 'Mix';
  const subtitle = params.get('s') ?? '';
  const [saving, setSaving] = useState(false);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['mix', id], queryFn: () => api.mix(id), staleTime: 30 * 60_000 });
  const songs = data?.songs ?? [];
  const isAi = id.startsWith('ai-');
  const context = { label: title, href: `/mix/${encodeURIComponent(id)}?t=${encodeURIComponent(title)}&s=${encodeURIComponent(subtitle)}` };

  return (
    <div className="animate-fade-in">
      <CollectionHeader
        eyebrow={isAi ? <span className="inline-flex items-center gap-1.5"><Sparkles className="size-3.5" aria-hidden /> Mix IA personnalisé</span> : id.startsWith('radio-') ? <span className="inline-flex items-center gap-1.5"><Radio className="size-3.5" aria-hidden /> Radio</span> : 'Mix'}
        title={title}
        description={subtitle}
        meta={songs.length ? `${pluralize(songs.length, 'titre')} · ${formatTotal(songs.reduce((n, s) => n + s.duration, 0))}` : undefined}
        cover={<Mosaic ids={songs.slice(0, 4).map((s) => s.id)} className="w-full" />}
        colorFrom={songs[0]?.id}
        actions={
          songs.length ? (
            <PlayActions
              songs={songs}
              context={context}
              extra={<Button variant="secondary" onClick={() => setSaving(true)}>Enregistrer</Button>}
            />
          ) : undefined
        }
      />
      <div className="px-2 pb-6 sm:px-6">
        {error ? <ErrorState message={(error as Error).message} onRetry={() => refetch()} /> : isLoading ? <SongListSkeleton /> : <SongList songs={songs} context={context} showReason />}
      </div>
      <CreatePlaylistDialog open={saving} onClose={() => setSaving(false)} initialSongs={songs} initialName={title} description={subtitle} aiPrompt={isAi ? title : undefined} />
    </div>
  );
}
