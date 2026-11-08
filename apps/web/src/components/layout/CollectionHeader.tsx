import type { ReactNode } from 'react';
import { useCoverColor } from '../../hooks/useAccent';

/**
 * Header for pages and collections: a vertical gradient washed with the
 * colour of the collection's cover (yellow FEO accent when there is none).
 */
export function CollectionHeader({
  eyebrow,
  title,
  description,
  meta,
  cover,
  colorFrom,
  actions,
}: {
  eyebrow: ReactNode;
  title: string;
  description?: ReactNode;
  meta?: ReactNode;
  cover?: ReactNode;
  colorFrom?: string;
  actions?: ReactNode;
}) {
  const color = useCoverColor(colorFrom) ?? 'var(--accent)';
  return (
    <header className="relative isolate -mt-16 overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 -z-10 transition-[background] duration-700"
        style={{ background: `linear-gradient(180deg, color-mix(in oklab, ${color} 62%, var(--surface)) 0%, color-mix(in oklab, ${color} 22%, var(--surface)) 72%, var(--surface) 100%)` }}
        aria-hidden
      />
      <div className="px-4 pt-24 pb-6 sm:px-8 sm:pt-28">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-end">
          {cover && <div className="w-48 shrink-0 animate-fade-up overflow-hidden rounded-md sm:w-52 lg:w-56">{cover}</div>}
          <div className={`min-w-0 flex-1 ${cover ? 'text-center sm:text-left' : 'w-full'}`}>
            <p className="text-sm font-bold">{eyebrow}</p>
            <h1 className="mt-2 font-display text-4xl font-black tracking-tight text-balance sm:text-6xl lg:text-7xl">{title}</h1>
            {description && <p className="mt-3 max-w-2xl text-sm text-fg-2 text-pretty">{description}</p>}
            {meta && <p className="mt-2 text-sm font-semibold">{meta}</p>}
          </div>
        </div>
      </div>
      {actions && (
        <div className="bg-gradient-to-b from-black/[0.06] to-transparent px-4 pt-5 pb-2 sm:px-8 dark:from-black/25">
          <div className={`flex flex-wrap items-center gap-3 ${cover ? 'justify-center sm:justify-start' : ''}`}>{actions}</div>
        </div>
      )}
    </header>
  );
}

export function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4 px-0.5">
      <div className="min-w-0">
        <h2 className="font-display text-2xl font-bold tracking-tight">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-fg-2">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
