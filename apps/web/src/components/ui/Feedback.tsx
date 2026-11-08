import { AlertCircle, Check, Info, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/format';
import { useUiStore } from '../../stores/ui';
import { usePlayerStore } from '../../stores/player';
import { Button } from './Button';

export function Toaster() {
  const { toasts, dismiss } = useUiStore();
  // Over the full-screen player, toasts move to the top so they never cover the controls.
  const overPlayer = usePlayerStore((s) => s.nowPlayingOpen);
  return (
    <div
      aria-live="polite"
      className={cn(
        'pointer-events-none fixed inset-x-0 z-[100] flex flex-col items-center gap-2 px-4',
        overPlayer ? 'top-[max(4.5rem,calc(env(safe-area-inset-top)+4rem))]' : 'bottom-[calc(9.5rem+env(safe-area-inset-bottom))] md:bottom-28',
      )}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className="pointer-events-auto flex max-w-md animate-sheet-up items-center gap-3 rounded-lg bg-fg py-2.5 pr-2 pl-4 text-sm font-semibold text-bg"
        >
          {t.tone === 'success' ? (
            <Check className="size-4 shrink-0 text-accent" aria-hidden />
          ) : t.tone === 'error' ? (
            <AlertCircle className="size-4 shrink-0 text-[#ff8a7a]" aria-hidden />
          ) : (
            <Info className="size-4 shrink-0 opacity-70" aria-hidden />
          )}
          <span className="min-w-0 flex-1">{t.message}</span>
          {t.action && (
            <button
              onClick={() => { t.action!.run(); dismiss(t.id); }}
              className="rounded-full px-3 py-1.5 text-sm font-bold underline-offset-2 hover:bg-bg/10 hover:underline"
            >
              {t.action.label}
            </button>
          )}
          <button onClick={() => dismiss(t.id)} aria-label="Fermer la notification" className="grid size-8 place-items-center rounded-full opacity-60 hover:bg-bg/10 hover:opacity-100">
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-lg', className)} aria-hidden />;
}

export function SongListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-1" aria-label="Chargement" role="status">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2">
          <Skeleton className="size-11 shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="hidden h-3 w-10 sm:block" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center px-6 py-16 text-center animate-fade-up">
      <div className="mb-5 grid size-16 place-items-center rounded-2xl bg-fg/6 text-accent-fg [&>svg]:size-7">{icon}</div>
      <h3 className="font-display text-xl font-bold">{title}</h3>
      {children && <p className="mt-2 text-sm text-fg-2">{children}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <EmptyState icon={<AlertCircle />} title="Oups, ça n'a pas marché" action={onRetry && <Button onClick={onRetry}>Réessayer</Button>}>
      {message}
    </EmptyState>
  );
}

/** Small animated equaliser shown on the song that is playing. */
export function Equalizer({ playing, className }: { playing: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex h-3.5 items-end gap-[2px]', className)} aria-hidden>
      {[0, 200, 400].map((d) => (
        <span
          key={d}
          className={cn('w-[3px] origin-bottom rounded-full bg-accent-fg', playing ? 'animate-eq' : 'scale-y-50')}
          style={{ animationDelay: `${d}ms`, height: '100%' }}
        />
      ))}
    </span>
  );
}
