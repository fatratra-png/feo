import { ArrowLeft, Compass, Home } from 'lucide-react';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../components/ui/Logo';

/** Shown for any unknown URL: a dead end should still lead back into the app. */
export function NotFound() {
  useEffect(() => {
    document.title = 'Page introuvable — FEO';
  }, []);

  return (
    <div className="grid min-h-dvh place-items-center bg-bg px-5 py-12">
      <div className="w-full max-w-lg text-center">
        <Link to="/" aria-label="FEO, accueil" className="inline-block">
          <Logo className="text-4xl" />
        </Link>

        <p className="mt-10 font-display text-7xl font-extrabold tracking-tight text-accent sm:text-8xl">404</p>
        <h1 className="mt-3 font-display text-2xl font-bold sm:text-3xl">Cette page n'existe pas</h1>
        <p className="mx-auto mt-3 max-w-sm text-fg-2">
          Le lien est peut-être périmé, ou l'adresse contient une faute de frappe. La musique, elle, est toujours là.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/"
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 font-semibold text-on-accent transition hover:brightness-105 sm:w-auto"
          >
            <Home className="size-5" aria-hidden /> Retour à l'accueil
          </Link>
          <Link
            to="/search"
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-line-strong px-6 py-3 font-semibold text-fg transition hover:bg-surface-2 sm:w-auto"
          >
            <Compass className="size-5" aria-hidden /> Chercher un titre
          </Link>
        </div>

        <p className="mt-10 text-sm text-fg-3">
          <Link to="/install" className="inline-flex items-center gap-1.5 font-semibold text-accent-fg hover:underline">
            <ArrowLeft className="size-4" aria-hidden /> Installer FEO sur ton téléphone
          </Link>
        </p>
      </div>
    </div>
  );
}
