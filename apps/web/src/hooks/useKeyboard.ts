import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayerStore } from '../stores/player';

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

/**
 * Space: play/pause · Shift+←/→: previous/next · ←/→: ±5 s
 * ↑/↓: volume · M: mute · S: shuffle · L: repeat · Ctrl/⌘+K or /: search
 */
export function useKeyboard() {
  const navigate = useNavigate();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        navigate('/search');
        requestAnimationFrame(() => document.getElementById('search-input')?.focus());
        return;
      }
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const p = usePlayerStore.getState();
      switch (e.key) {
        case ' ':
          if (e.target instanceof HTMLButtonElement) return;
          e.preventDefault(); p.togglePlay(); break;
        case 'ArrowRight':
          e.preventDefault(); e.shiftKey ? p.next() : p.seek(Math.min(p.duration, p.position + 5)); break;
        case 'ArrowLeft':
          e.preventDefault(); e.shiftKey ? p.previous() : p.seek(Math.max(0, p.position - 5)); break;
        case 'ArrowUp':
          if (!p.current()) return;
          e.preventDefault(); p.setVolume(p.volume + 0.05); break;
        case 'ArrowDown':
          if (!p.current()) return;
          e.preventDefault(); p.setVolume(p.volume - 0.05); break;
        case 'm': case 'M': p.toggleMute(); break;
        case 's': case 'S': p.toggleShuffle(); break;
        case 'l': case 'L': p.cycleRepeat(); break;
        case '/':
          e.preventDefault();
          navigate('/search');
          requestAnimationFrame(() => document.getElementById('search-input')?.focus());
          break;
        case 'Escape':
          if (p.nowPlayingOpen) p.closeNowPlaying();
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);
}
