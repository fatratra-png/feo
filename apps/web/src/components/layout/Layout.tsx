import { Outlet } from 'react-router-dom';
import { PlayerPanel } from '../player/PlayerPanel';
import { useKeyboard } from '../../hooks/useKeyboard';

export function Layout() {
  useKeyboard();

  return (
    <div className="min-h-screen bg-background">
      <main className="min-h-screen">
        <Outlet />
      </main>
      <PlayerPanel />
    </div>
  );
}
