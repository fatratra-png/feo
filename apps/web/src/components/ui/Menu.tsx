import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/format';

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

interface MenuProps {
  trigger: (props: { onClick: (e: React.MouseEvent) => void; 'aria-expanded': boolean; 'aria-haspopup': 'menu' }) => ReactNode;
  items: (MenuItem | 'divider')[];
  header?: ReactNode;
}

/** Accessible popover menu: arrow keys, Escape, click-outside, viewport-aware. */
export function Menu({ trigger, items, header }: MenuProps) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const open = anchor !== null;
  const close = () => { setAnchor(null); setPos(null); };

  useLayoutEffect(() => {
    if (!anchor || !ref.current) return;
    const { width, height } = ref.current.getBoundingClientRect();
    const margin = 8;
    let left = anchor.right - width;
    if (left < margin) left = Math.min(anchor.left, window.innerWidth - width - margin);
    let top = anchor.bottom + 6;
    if (top + height > window.innerHeight - margin) top = Math.max(margin, anchor.top - height - 6);
    setPos({ top, left: Math.max(margin, left) });
    ref.current.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus();
  }, [anchor]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) close(); };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); close(); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const els = [...(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [])];
        const i = els.indexOf(document.activeElement as HTMLElement);
        els[(i + (e.key === 'ArrowDown' ? 1 : -1) + els.length) % els.length]?.focus();
      }
    };
    const onScroll = () => close();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', onScroll);
    document.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', onScroll);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  return (
    <>
      {trigger({
        onClick: (e) => {
          e.stopPropagation();
          open ? close() : setAnchor((e.currentTarget as HTMLElement).getBoundingClientRect());
        },
        'aria-expanded': open,
        'aria-haspopup': 'menu',
      })}
      {open &&
        createPortal(
          <div
            ref={ref}
            role="menu"
            style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
            className="fixed z-[90] min-w-56 max-w-72 animate-fade-in rounded-md bg-surface-3 p-1"
            onClick={(e) => e.stopPropagation()}
          >
            {header && <div className="border-b border-line px-3 pt-2 pb-2.5 mb-1">{header}</div>}
            {items.map((item, i) =>
              item === 'divider' ? (
                <div key={i} className="my-1 h-px bg-line" />
              ) : (
                <button
                  key={item.label}
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => { close(); item.onSelect(); }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium outline-none transition-colors',
                    'hover:bg-fg/8 focus-visible:bg-fg/8 disabled:opacity-40',
                    item.danger ? 'text-danger' : 'text-fg',
                  )}
                >
                  <span className="grid size-4 place-items-center text-fg-2 [&>svg]:size-4" aria-hidden>{item.icon}</span>
                  {item.label}
                </button>
              ),
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
