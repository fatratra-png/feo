import { cn } from '../../lib/format';

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('wordmark inline-block text-[30px] leading-none select-none', className)}>FEO<span className="dot">.</span></span>
  );
}
