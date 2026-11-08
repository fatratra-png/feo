import { Loader2, Pause, Play } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/format';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: ReactNode;
}

/* Flat buttons: filled yellow (primary) or outlined (secondary); subtle scale on hover/press. */
const variants: Record<Variant, string> = {
  primary: 'press bg-accent text-on-accent hover:brightness-105',
  secondary: 'press border border-line-strong text-fg hover:border-fg',
  ghost: 'text-fg-2 hover:text-fg hover:bg-fg/[0.07] active:scale-[0.97]',
  danger: 'press bg-danger text-white',
};
const sizes = { sm: 'h-9 px-3.5 text-sm gap-1.5', md: 'h-11 px-5 text-sm gap-2', lg: 'h-12 px-6 text-base gap-2' };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, icon, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex select-none items-center justify-center rounded-full font-bold transition-[background-color,color,transform] duration-150 disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

/** Icon-only button: always labelled, always ≥ 36px hit area. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, active, size = 'md', className, children, ...rest },
  ref,
) {
  const s = { sm: 'size-9', md: 'size-10', lg: 'size-12' }[size];
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'relative inline-grid shrink-0 place-items-center rounded-full transition-colors duration-150 active:scale-95 disabled:opacity-40',
        active ? 'text-accent-fg' : 'text-fg-2 hover:text-fg',
        'hover:bg-fg/[0.07]',
        s,
        className,
      )}
      {...rest}
    >
      {children}
      {active && <span className="absolute bottom-1 size-1 rounded-full bg-accent-fg" aria-hidden />}
    </button>
  );
});

/** The big round yellow play button (FEO accent). */
export function PlayButton({
  playing,
  onClick,
  size = 'lg',
  label,
  className,
}: {
  playing: boolean;
  onClick: (e: React.MouseEvent) => void;
  size?: 'md' | 'lg' | 'xl';
  label?: string;
  className?: string;
}) {
  const s = { md: 'size-11', lg: 'size-14', xl: 'size-16' }[size];
  const i = { md: 'size-5', lg: 'size-6', xl: 'size-7' }[size];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label ?? (playing ? 'Pause' : 'Lecture')}
      className={cn('press grid shrink-0 place-items-center rounded-full bg-accent text-on-accent hover:brightness-105', s, className)}
    >
      {playing ? <Pause className={cn(i, 'fill-current')} aria-hidden /> : <Play className={cn(i, 'ml-0.5 fill-current')} aria-hidden />}
    </button>
  );
}
