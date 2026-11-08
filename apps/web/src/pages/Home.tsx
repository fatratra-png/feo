import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Headphones, RefreshCw, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CollectionHeader, SectionTitle } from '../components/layout/CollectionHeader';
import { CardRow, MixCard, PlaylistCard, QuickTile } from '../components/song/Cards';
import { Button } from '../components/ui/Button';
import { ErrorState, Skeleton } from '../components/ui/Feedback';
import { api } from '../lib/api';
import { greeting } from '../lib/format';
import type { Mix, PlaylistSummary } from '../lib/types';
import { useAuthStore } from '../stores/auth';
import { usePlayerStore } from '../stores/player';
import { toast } from '../stores/ui';

const PROMPTS = ['Afro chill pour un dimanche', 'Hira gasy classiques', 'Motivation sport', 'R&B des années 2000', 'Pluie et café'];

function AiPromptBar() {
  const [prompt, setPrompt] = useState('');
  const navigate = useNavigate();
  const go = (p: string) => p.trim() && navigate(`/create?prompt=${encodeURIComponent(p.trim())}`);
  return (
    <div className="mt-6 w-full max-w-2xl">
      <form
        onSubmit={(e) => { e.preventDefault(); go(prompt); }}
        className="group flex items-center gap-2 rounded-full border border-line-strong bg-surface/80 p-1.5 pl-5 backdrop-blur-xl transition focus-within:border-accent/70"
      >
        <Sparkles className="size-5 shrink-0 text-accent-fg" aria-hidden />
        <label htmlFor="home-prompt" className="sr-only">Décris ce que tu veux écouter</label>
        <input
          id="home-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Décris ce que tu veux écouter…"
          className="h-11 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-fg-3"
        />
        <Button variant="primary" type="submit" disabled={!prompt.trim()} aria-label="Créer la playlist" className="!h-11 !px-4">
          <span className="hidden sm:inline">Créer</span>
          <ArrowRight className="size-4" aria-hidden />
        </Button>
      </form>
      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
        {PROMPTS.map((p) => (
          <button key={p} onClick={() => go(p)} className="shrink-0 rounded-full border border-line-strong bg-fg/[0.04] px-3.5 py-1.5 text-[13px] font-medium text-fg-2 transition hover:border-accent/60 hover:text-fg">
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

function PendingMixCard() {
  return (
    <div className="flex flex-col gap-3 p-2.5" role="status" aria-label="L'IA compose tes mix">
      <div className="relative grid aspect-square w-full place-items-center overflow-hidden rounded-xl border border-dashed border-accent/40 bg-[radial-gradient(circle_at_30%_20%,color-mix(in_oklab,var(--accent)_30%,transparent),transparent_70%)]">
        <Sparkles className="size-8 animate-pulse text-accent-fg" aria-hidden />
      </div>
      <div className="px-0.5">
        <p className="font-semibold">L'IA compose…</p>
        <p className="text-[13px] text-fg-2">Tes mix personnalisés arrivent</p>
      </div>
    </div>
  );
}

async function playMix(mix: Mix) {
  const p = usePlayerStore.getState();
  if (p.context?.label === mix.title) return p.togglePlay();
  try {
    const { songs } = await api.mix(mix.id);
    if (!songs.length) return toast('Ce mix est vide pour le moment', { tone: 'error' });
    p.playSongs(songs, 0, { label: mix.title, href: `/mix/${encodeURIComponent(mix.id)}?t=${encodeURIComponent(mix.title)}&s=${encodeURIComponent(mix.subtitle)}` });
  } catch (err) {
    toast((err as Error).message, { tone: 'error' });
  }
}

async function playPlaylist(pl: PlaylistSummary) {
  const p = usePlayerStore.getState();
  if (p.context?.label === pl.name) return p.togglePlay();
  try {
    const full = await api.playlists.get(pl.id);
    p.playSongs(full.songs, 0, { label: pl.name, href: `/playlist/${pl.id}` });
  } catch (err) {
    toast((err as Error).message, { tone: 'error' });
  }
}

export function Home() {
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const ctxLabel = usePlayerStore((s) => s.context?.label);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const currentId = usePlayerStore((s) => s.queue[s.index]?.id);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['home'],
    queryFn: api.home,
    // While the AI is composing in the background, check back regularly.
    refetchInterval: (q) => (q.state.data?.aiPending ? 8000 : false),
  });

  const regenerate = useMutation({
    mutationFn: api.refreshHome,
    onSuccess: () => {
      toast("L'IA recompose tes mix, ça prend environ une minute");
      qc.setQueryData(['home'], (d: typeof data) => (d ? { ...d, aiPending: true } : d));
      setTimeout(() => qc.invalidateQueries({ queryKey: ['home'] }), 8000);
    },
    onError: (err: Error) => toast(err.message, { tone: 'error' }),
  });

  const firstName = user?.displayName.split(' ')[0] ?? '';
  const isNew = data && data.recent.length === 0;

  return (
    <div className="animate-fade-in">
      <CollectionHeader
        eyebrow={<span className="inline-flex items-center gap-1.5"><Headphones className="size-3.5" aria-hidden /> Henoy ara</span>}
        title={`${greeting()}, ${firstName}`}
        description={isNew ? 'Lance quelques titres : FEO apprend tes goûts et l’IA compose des mix rien que pour toi.' : 'Que veux-tu écouter aujourd’hui ?'}
        colorFrom={currentId}
      />
      <div className="-mt-4 px-4 sm:px-8">
        <AiPromptBar />
      </div>

      <div className="mt-10 space-y-12 px-4 sm:px-8">
        {error ? (
          <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
        ) : isLoading || !data ? (
          <>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 xl:grid-cols-6">
              {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="aspect-square rounded-xl" />)}
            </div>
          </>
        ) : (
          <>
            {data.recent.length > 0 && (
              <section>
                <SectionTitle title="Reprendre l'écoute" />
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {data.recent.slice(0, 6).map((song, i) => (
                    <QuickTile
                      key={song.id}
                      song={song}
                      active={song.id === currentId}
                      playing={isPlaying}
                      onPlay={() => {
                        const p = usePlayerStore.getState();
                        if (song.id === currentId) return p.togglePlay();
                        p.playSongs(data.recent, i, { label: 'Écoutés récemment', href: '/library?tab=history' });
                      }}
                    />
                  ))}
                </div>
              </section>
            )}

            {data.aiPausedUntil && (
              <p className="flex items-start gap-3 rounded-2xl border border-line-strong bg-fg/[0.04] p-4 text-sm text-fg-2" role="status">
                <Sparkles className="mt-0.5 size-4 shrink-0 text-fg-3" aria-hidden />
                <span>
                  L'IA se repose jusqu'à {new Date(data.aiPausedUntil).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} (quota quotidien atteint).
                  La musique, la radio et la recherche continuent de fonctionner normalement.
                </span>
              </p>
            )}

            <section>
              <SectionTitle
                title={data.aiReady ? 'Pour toi' : isNew ? 'Pour commencer' : 'Tes mix'}
                subtitle={
                  data.aiReady
                    ? 'Composés par l’IA à partir de tes écoutes'
                    : data.aiPending
                      ? 'L’IA analyse tes écoutes pour créer des mix personnalisés'
                      : data.aiEnabled && !isNew
                        ? 'Écoute encore quelques titres pour débloquer les mix IA'
                        : undefined
                }
                action={
                  data.aiEnabled && !data.aiPausedUntil && data.topArtists.length > 0 && !data.aiPending ? (
                    <Button variant="ghost" size="sm" icon={<RefreshCw className="size-4" />} loading={regenerate.isPending} onClick={() => regenerate.mutate()}>
                      <span className="hidden sm:inline">Régénérer</span>
                    </Button>
                  ) : undefined
                }
              />
              <CardRow>
                {data.aiPending && <PendingMixCard />}
                {data.mixes.map((mix) => (
                  <MixCard key={mix.id} mix={mix} playing={ctxLabel === mix.title && isPlaying} onPlay={() => playMix(mix)} />
                ))}
              </CardRow>
            </section>

            {data.playlists.length > 0 && (
              <section>
                <SectionTitle
                  title="Tes playlists"
                  action={<Button variant="ghost" size="sm" onClick={() => navigate('/library')}>Tout afficher</Button>}
                />
                <CardRow>
                  {data.playlists.map((p) => (
                    <PlaylistCard key={p.id} playlist={p} playing={ctxLabel === p.name && isPlaying} onPlay={() => playPlaylist(p)} />
                  ))}
                </CardRow>
              </section>
            )}

            {data.topArtists.length > 0 && (
              <section>
                <SectionTitle title="Tes artistes du moment" />
                <div className="flex flex-wrap gap-2">
                  {data.topArtists.map((a) => (
                    <button
                      key={a.name}
                      onClick={() => navigate(`/search?q=${encodeURIComponent(a.name)}`)}
                      className="rounded-full border border-line-strong bg-fg/[0.04] px-4 py-2 text-sm font-semibold transition hover:border-accent/60 hover:bg-fg/[0.08]"
                    >
                      {a.name}
                    </button>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
