import { ChevronDown, ListMusic, Loader2, Radio, Sparkles, Trash2, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { coverUrl } from '../../lib/api';
import { cn, formatTime } from '../../lib/format';
import { usePlayerStore } from '../../stores/player';
import { LikeButton, SongMenu, moveActions } from '../song/SongActions';
import { Button, IconButton } from '../ui/Button';
import { Cover } from '../ui/Cover';
import { Equalizer } from '../ui/Feedback';
import { ProgressBar, RadioToggle, TransportControls, VolumeControl } from './Controls';

function QueuePanel() {
  const { queue, index, isPlaying, jumpTo, removeAt, move, clearUpcoming, radio, radioLoading } = usePlayerStore();
  const upcoming = queue.slice(index + 1);
  const current = queue[index];

  return (
    <div className="flex h-full flex-col">
      {current && (
        <div className="mb-4">
          <p className="mb-2 px-2 text-xs font-bold tracking-wide text-fg-3 uppercase">En cours</p>
          <div className="flex items-center gap-3 rounded-xl bg-fg/[0.07] p-2">
            <Cover id={current.id} className="size-11" rounded="rounded-md" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-accent-fg">{current.title}</p>
              <p className="truncate text-xs text-fg-2">{current.artist}</p>
            </div>
            <Equalizer playing={isPlaying} className="mr-2" />
          </div>
        </div>
      )}

      <div className="mb-2 flex items-center justify-between px-2">
        <p className="text-xs font-bold tracking-wide text-fg-3 uppercase">À suivre · {upcoming.length}</p>
        {upcoming.length > 0 && (
          <button onClick={clearUpcoming} className="rounded-full px-2 py-1 text-xs font-semibold text-fg-2 hover:bg-fg/8 hover:text-fg">
            Vider
          </button>
        )}
      </div>

      <ul className="-mx-1 flex-1 space-y-0.5 overflow-y-auto px-1 pb-4">
        {upcoming.map((item, k) => {
          const i = index + 1 + k;
          return (
            <li key={item.uid} className="group flex items-center gap-3 rounded-xl p-2 hover:bg-fg/[0.05]">
              <button onClick={() => jumpTo(i)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`Lire ${item.title}`}>
                <Cover id={item.id} className="size-11" rounded="rounded-md" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{item.title}</p>
                  <p className="truncate text-xs text-fg-2">
                    {item.from === 'radio' && <Radio className="mr-1 inline size-3 text-accent-fg" aria-label="Radio" />}
                    {item.artist}
                    {item.reason && <span className="text-fg-3"> · {item.reason}</span>}
                  </p>
                </div>
              </button>
              <span className="hidden text-xs tabular-nums text-fg-3 sm:block">{item.duration ? formatTime(item.duration) : ''}</span>
              <IconButton label={`Retirer ${item.title} de la file`} size="sm" onClick={() => removeAt(i)} className="sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100">
                <Trash2 className="size-4" />
              </IconButton>
              <SongMenu song={item} extra={moveActions(k, upcoming.length, (f, t) => move(index + 1 + f, index + 1 + t))} />
            </li>
          );
        })}
        {radioLoading && (
          <li className="flex items-center gap-3 rounded-xl p-3 text-sm text-fg-2">
            <Loader2 className="size-4 animate-spin text-accent-fg" aria-hidden /> La radio IA choisit la suite…
          </li>
        )}
        {!upcoming.length && !radioLoading && (
          <li className="rounded-2xl border border-dashed border-line-strong p-5 text-center text-sm text-fg-2">
            {radio ? 'La radio IA ajoutera des titres automatiquement.' : 'La file est vide. Active la radio IA pour ne jamais t’arrêter.'}
          </li>
        )}
      </ul>
    </div>
  );
}

export function NowPlaying() {
  const open = usePlayerStore((s) => s.nowPlayingOpen);
  const tab = usePlayerStore((s) => s.nowPlayingTab);
  const song = usePlayerStore((s) => s.queue[s.index] ?? null);
  const context = usePlayerStore((s) => s.context);
  const close = usePlayerStore((s) => s.closeNowPlaying);
  const setTab = (t: 'queue' | 'about') => usePlayerStore.setState({ nowPlayingTab: t });
  const closeBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeBtn.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open || !song) return null;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Lecteur plein écran" data-theme="dark" className="fixed inset-0 z-[70] animate-sheet-up overflow-hidden bg-bg text-fg">
      {/* Ambient background from the cover */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <img src={coverUrl(song.id)} alt="" className="absolute inset-0 h-full w-full scale-125 object-cover opacity-50 blur-3xl saturate-150" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklab,var(--accent)_35%,transparent),transparent_60%),linear-gradient(to_bottom,rgb(8_8_12/0.35),rgb(8_8_12/0.92))]" />
      </div>

      <div className="relative mx-auto flex h-full max-w-6xl flex-col px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-8">
        <div className="flex items-center justify-between gap-4 py-2">
          <IconButton ref={closeBtn} label="Réduire le lecteur" onClick={close}>
            <ChevronDown className="size-6 md:hidden" />
            <X className="hidden size-5 md:block" />
          </IconButton>
          <div className="min-w-0 text-center">
            <p className="text-[11px] font-bold tracking-wider text-fg/60 uppercase">En lecture depuis</p>
            <p className="truncate text-sm font-semibold">
              {context?.href ? <Link to={context.href} onClick={close} className="hover:underline">{context.label}</Link> : context?.label ?? 'Ta sélection'}
            </p>
          </div>
          <IconButton label="File d'attente" active={tab === 'queue'} onClick={() => setTab(tab === 'queue' ? 'about' : 'queue')} className="lg:invisible">
            <ListMusic className="size-5" />
          </IconButton>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-12">
          {/* Main column */}
          <div className={cn('flex min-h-0 flex-col justify-center', tab === 'queue' && 'hidden lg:flex')}>
            <div className="mx-auto w-full max-w-[min(440px,48dvh)]">
              <Cover key={song.id} id={song.id} size="lg" className="w-full animate-fade-in" rounded="rounded-2xl" />
            </div>

            <div className="mx-auto mt-8 w-full max-w-[520px]">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-display text-2xl font-bold sm:text-3xl">{song.title}</h2>
                  <Link to={`/search?q=${encodeURIComponent(song.artist.split(',')[0])}`} onClick={close} className="truncate text-base text-fg-2 hover:text-fg hover:underline">
                    {song.artist}
                  </Link>
                </div>
                <LikeButton song={song} size="md" />
                <SongMenu song={song} />
              </div>

              {song.reason && (
                <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-fg/8 px-3 py-1.5 text-xs font-medium text-fg-2">
                  <Sparkles className="size-3.5 text-accent-fg" aria-hidden /> Choisi par l'IA : {song.reason}
                </p>
              )}

              <div className="mt-5"><ProgressBar /></div>
              <div className="mt-3"><TransportControls size="lg" /></div>
              <div className="mt-4 hidden items-center justify-between sm:flex">
                <RadioToggle />
                <VolumeControl />
              </div>
            </div>
          </div>

          {/* Queue column */}
          <aside className={cn('min-h-0 rounded-3xl lg:block lg:bg-surface/80 lg:p-4 lg:backdrop-blur-xl', tab === 'queue' ? 'block' : 'hidden')}>
            <div className="flex h-full flex-col">
              <QueuePanel />
              <div className="mt-2 flex justify-center lg:hidden">
                <Button variant="ghost" size="sm" onClick={() => setTab('about')}>Retour au titre</Button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>,
    document.body,
  );
}
