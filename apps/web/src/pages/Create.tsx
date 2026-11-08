import { useMutation } from '@tanstack/react-query';
import { Check, RefreshCw, Save, Shuffle, Sparkles, Wand2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CreatePlaylistDialog } from '../components/layout/PlaylistDialogs';
import { SongList } from '../components/song/SongList';
import { Button, IconButton, PlayButton } from '../components/ui/Button';
import { Mosaic } from '../components/ui/Cover';
import { SongListSkeleton } from '../components/ui/Feedback';
import { api } from '../lib/api';
import { cn, formatTotal, pluralize } from '../lib/format';
import type { GeneratedPlaylist } from '../lib/types';
import { usePlayerStore } from '../stores/player';

const IDEAS = [
  'Soirée chill malgache des années 2000',
  'Afrobeats et amapiano pour faire la fête',
  'Musique douce pour travailler sans paroles',
  'Classiques R&B des années 90 pour la route',
  'Salegy et tsapiky pour danser',
  'Hits francophones pour chanter sous la douche',
  'Gospel apaisant pour le dimanche matin',
  'Rap français énergique pour la salle de sport',
];

const STEPS = ['Analyse de ta demande', 'Sélection des titres par l’IA', 'Vérification sur YouTube', 'Mise en ordre de la playlist'];

function Progress() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timers = [3500, 12000, 22000].map((ms, i) => setTimeout(() => setStep(i + 1), ms));
    return () => timers.forEach(clearTimeout);
  }, []);
  return (
    <div className="rounded-3xl border border-line-strong bg-fg/[0.03] p-6" role="status" aria-live="polite">
      <div className="mb-5 flex items-center gap-3">
        <span className="relative grid size-10 place-items-center rounded-full bg-accent/15">
          <Sparkles className="size-5 animate-pulse text-accent-fg" aria-hidden />
        </span>
        <div>
          <p className="font-semibold">L'IA compose ta playlist…</p>
          <p className="text-sm text-fg-2">Cela prend en général 20 à 40 secondes.</p>
        </div>
      </div>
      <ol className="space-y-3">
        {STEPS.map((label, i) => (
          <li key={label} className={cn('flex items-center gap-3 text-sm transition-colors', i <= step ? 'text-fg' : 'text-fg-3')}>
            <span className={cn('grid size-6 place-items-center rounded-full border text-[11px] font-bold', i < step ? 'border-accent bg-accent text-on-accent' : i === step ? 'border-accent text-accent-fg' : 'border-line-strong')}>
              {i < step ? <Check className="size-3.5" aria-hidden /> : i + 1}
            </span>
            {label}
            {i === step && <span className="size-1.5 animate-pulse rounded-full bg-accent" aria-hidden />}
          </li>
        ))}
      </ol>
      <div className="mt-6"><SongListSkeleton rows={4} /></div>
    </div>
  );
}

export function Create() {
  const [params, setParams] = useSearchParams();
  const initial = params.get('prompt') ?? '';
  const [prompt, setPrompt] = useState(initial);
  const [count, setCount] = useState(20);
  const [result, setResult] = useState<(GeneratedPlaylist & { prompt: string }) | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const ctxLabel = usePlayerStore((s) => s.context?.label);
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  const generate = useMutation({
    mutationFn: (p: string) => api.generatePlaylist(p, count),
    onSuccess: (data, p) => { setResult({ ...data, prompt: p }); setSavedId(null); },
  });

  // Arriving from the home prompt bar: start right away.
  useEffect(() => {
    if (initial && !generate.isPending && !result) generate.mutate(initial);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = (p = prompt) => {
    const text = p.trim();
    if (text.length < 3) return textarea.current?.focus();
    setPrompt(text);
    setParams({ prompt: text }, { replace: true });
    generate.mutate(text);
  };

  const context = result ? { label: result.name, href: savedId ? `/playlist/${savedId}` : undefined } : null;
  const playing = Boolean(result && ctxLabel === result.name && isPlaying);

  return (
    <div className="animate-fade-in">
      <section className="relative -mt-16 overflow-hidden px-4 pt-24 pb-8 sm:px-8 sm:pt-28">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_20%_0%,color-mix(in_oklab,var(--accent)_40%,transparent),transparent_60%),radial-gradient(ellipse_at_90%_30%,rgb(236_72_153/0.16),transparent_50%)]" aria-hidden />
        <p className="inline-flex items-center gap-1.5 rounded-full bg-fg/[0.08] px-3 py-1 text-xs font-bold tracking-wide text-fg uppercase">
          <Wand2 className="size-3.5 text-accent-fg" aria-hidden /> Studio IA
        </p>
        <h1 className="mt-4 max-w-3xl font-display text-4xl font-extrabold tracking-tight text-balance sm:text-6xl">
          Décris un moment, <span className="text-accent-fg transition-colors duration-700">l'IA en fait une playlist.</span>
        </h1>
        <p className="mt-3 max-w-xl text-fg-2">Une ambiance, une époque, un pays, une activité… Plus tu es précis, meilleure est la sélection.</p>

        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="mt-8 max-w-3xl">
          <label htmlFor="ai-prompt" className="sr-only">Ta demande</label>
          <div className="rounded-3xl border border-line-strong bg-surface/80 p-2 backdrop-blur-xl transition focus-within:border-accent/70">
            <textarea
              id="ai-prompt"
              ref={textarea}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
              rows={2}
              maxLength={300}
              placeholder="ex. Une soirée entre amis à Tana, salegy et afro, qui monte en énergie"
              className="w-full resize-none bg-transparent px-4 pt-3 text-lg outline-none placeholder:text-fg-3"
            />
            <div className="flex flex-wrap items-center justify-between gap-3 px-2 pb-1">
              <div className="flex items-center gap-1 rounded-full bg-fg/[0.06] p-1" role="radiogroup" aria-label="Nombre de titres">
                {[10, 20, 30].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={count === n}
                    onClick={() => setCount(n)}
                    className={cn('rounded-full px-3 py-1.5 text-xs font-bold transition-colors', count === n ? 'bg-fg text-bg' : 'text-fg-2 hover:text-fg')}
                  >
                    {n} titres
                  </button>
                ))}
              </div>
              <Button variant="primary" type="submit" loading={generate.isPending} icon={<Sparkles className="size-4" />} disabled={prompt.trim().length < 3}>
                {result ? 'Nouvelle génération' : 'Générer'}
              </Button>
            </div>
          </div>
        </form>

        {!result && !generate.isPending && (
          <div className="mt-5 flex max-w-3xl flex-wrap gap-2">
            {IDEAS.map((idea) => (
              <button key={idea} onClick={() => { setPrompt(idea); submit(idea); }} className="rounded-full border border-line-strong bg-fg/[0.04] px-3.5 py-2 text-sm text-fg-2 transition hover:border-accent/60 hover:text-fg">
                {idea}
              </button>
            ))}
          </div>
        )}
      </section>

      <div className="px-4 pb-8 sm:px-8">
        {generate.isPending ? (
          <Progress />
        ) : generate.error ? (
          <div className="rounded-3xl border border-danger/30 bg-danger/10 p-6" role="alert">
            <p className="font-semibold text-danger">La génération a échoué</p>
            <p className="mt-1 text-sm text-fg-2">{(generate.error as Error).message}</p>
            <Button className="mt-4" icon={<RefreshCw className="size-4" />} onClick={() => submit()}>Réessayer</Button>
          </div>
        ) : result ? (
          <section className="animate-fade-up rounded-3xl border border-line bg-fg/[0.025] p-4 sm:p-6">
            {result.model === 'fallback' && (
              <p className="mb-5 rounded-2xl border border-line-strong bg-fg/[0.04] p-3 text-sm text-fg-2">
                L'IA est momentanément saturée : voici une sélection basée sur une recherche. Réessaie dans une minute pour une vraie curation IA.
              </p>
            )}
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
              <Mosaic ids={result.songs.slice(0, 4).map((s) => s.id)} className="w-40 sm:w-44" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold tracking-wide text-accent-fg uppercase">{result.model === 'fallback' ? 'Sélection' : 'Proposition de l’IA'}</p>
                <h2 className="mt-1 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{result.name}</h2>
                {result.description && <p className="mt-2 text-sm text-fg-2">{result.description}</p>}
                <p className="mt-2 text-sm text-fg-3">
                  {pluralize(result.songs.length, 'titre')} · {formatTotal(result.songs.reduce((n, s) => n + s.duration, 0))}
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <PlayButton
                playing={playing}
                onClick={() => (ctxLabel === result.name ? usePlayerStore.getState().togglePlay() : usePlayerStore.getState().playSongs(result.songs, 0, context))}
              />
              <IconButton label="Lecture aléatoire" size="lg" onClick={() => usePlayerStore.getState().playShuffled(result.songs, context)}>
                <Shuffle className="size-6" />
              </IconButton>
              {savedId ? (
                <Button variant="secondary" icon={<Check className="size-4 text-success" />} disabled>Enregistrée</Button>
              ) : (
                <Button variant="secondary" icon={<Save className="size-4" />} onClick={() => setSaving(true)}>Enregistrer la playlist</Button>
              )}
              <Button variant="ghost" icon={<RefreshCw className="size-4" />} onClick={() => submit(result.prompt)}>Autre proposition</Button>
            </div>
            <div className="-mx-2 mt-6 sm:-mx-3">
              <SongList songs={result.songs} context={context} showReason />
            </div>
          </section>
        ) : null}
      </div>

      {result && (
        <CreatePlaylistDialog
          open={saving}
          onClose={() => setSaving(false)}
          initialSongs={result.songs}
          initialName={result.name}
          description={result.description}
          aiPrompt={result.model === 'fallback' ? undefined : result.prompt}
          onCreated={(id) => setSavedId(id)}
        />
      )}
    </div>
  );
}
