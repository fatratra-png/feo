import { useEffect, useState } from 'react';
import { Logo } from '../components/ui/Logo';
import { QrCode } from '../components/ui/QrCode';

/*
 * Public pages, also rendered to static HTML at build time (vite.config.ts):
 * no router or store imports, plain <a> links.
 */
export const SITE = 'https://feo-swart.vercel.app';
export const INSTALL_URL = `${SITE}/install`;
export const APK_URL = 'https://github.com/fatratra-png/feo/releases/latest/download/feo.apk';

const FEATURES = [
  { title: 'Une radio qui ne s’arrête jamais', body: 'Quand la file se vide, l’IA choisit la suite, sans jamais boucler sur le même artiste.', img: 'nowplaying' },
  { title: 'Une playlist à partir d’une phrase', body: '« Une soirée entre amis à Tana, salegy et afro » : FEO compose 10, 20 ou 30 titres à écouter et à garder.', img: 'create-empty' },
  { title: 'Cherche comme tu parles', body: '« La chanson de la Coupe du monde 2010 qui fait waka waka » : l’IA retrouve le titre.', img: 'search-playing' },
  { title: 'Des mix faits pour toi', body: 'L’accueil apprend de ce que tu écoutes, aimes ou passes, et se renouvelle tout seul.', img: 'mix' },
];

/** Reveals elements marked [data-reveal] as they scroll into view. */
function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('[data-reveal]');
    if (!('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add('is-in')); return; }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    }, { threshold: 0.15 });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

function Footer() {
  return (
    <footer className="border-t border-line-strong px-5 py-8 text-center text-sm text-fg-3">
      <a href="/privacy" className="hover:text-fg">Confidentialité</a>{' · '}
      <a href="/terms" className="hover:text-fg">Conditions d'utilisation</a>{' · '}
      <a href="mailto:nyfatratrar@gmail.com" className="hover:text-fg">Contact</a>
    </footer>
  );
}

export function Landing() {
  useReveal();
  // The intro plays once per browser session.
  const [intro, setIntro] = useState(false);
  useEffect(() => {
    try {
      if (sessionStorage.getItem('feo_intro')) return;
      sessionStorage.setItem('feo_intro', '1');
    } catch { /* private mode: play it */ }
    setIntro(true);
    const t = setTimeout(() => setIntro(false), 1900);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-dvh overflow-x-hidden bg-bg text-fg">
      {intro && (
        <div className="landing-intro fixed inset-0 z-50 grid place-items-center bg-bg" aria-hidden>
          <Logo className="landing-intro-logo text-7xl sm:text-8xl" />
        </div>
      )}

      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo className="text-3xl" />
        <nav className="flex items-center gap-2 text-sm font-semibold">
          <a href="#installer" className="hidden rounded-full px-4 py-2 hover:bg-fg/[0.06] sm:block">Installer l'app</a>
          <a href="/login" className="rounded-full px-4 py-2 hover:bg-fg/[0.06]">Se connecter</a>
          <a href="/register" className="rounded-full bg-accent px-4 py-2 text-on-accent transition hover:scale-[1.03]">Créer un compte</a>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pt-10 pb-20 lg:grid-cols-2 lg:pt-20">
          <div className="landing-rise">
            <p className="mb-4 inline-block rounded-full bg-accent-soft px-3 py-1 text-xs font-bold tracking-wide text-accent-fg uppercase">Gratuit · Web, Android, iPhone</p>
            <h1 className="font-display text-6xl leading-[0.95] font-extrabold tracking-tight sm:text-7xl">Henoy ara<span className="text-accent">.</span></h1>
            <p className="mt-6 max-w-md text-lg text-fg-2">
              Toute la musique, de Madagascar et d'ailleurs, avec une IA qui compose tes playlists et garde la musique en route.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="/register" className="rounded-full bg-accent px-7 py-3.5 font-bold text-on-accent transition hover:scale-[1.03]">Commencer gratuitement</a>
              <a href="#installer" className="rounded-full border border-line-strong px-7 py-3.5 font-bold transition hover:bg-fg/[0.06]">Installer l'app</a>
            </div>
          </div>
          <div className="landing-rise relative [animation-delay:150ms]">
            <div className="landing-glow absolute inset-8 rounded-full bg-accent/40 blur-3xl" aria-hidden />
            <img src="/assets/landing/banner.webp" alt="FEO sur ordinateur et sur téléphone" width={1800} height={825} className="landing-float relative w-full rounded-2xl border border-line-strong" fetchPriority="high" />
          </div>
        </section>

        <section className="mx-auto max-w-6xl space-y-20 px-5 py-10" aria-label="Ce que fait FEO">
          {FEATURES.map((f, i) => (
            <div key={f.title} data-reveal className={`reveal grid items-center gap-8 lg:grid-cols-2 ${i % 2 ? 'lg:[&>div]:order-2' : ''}`}>
              <div>
                <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{f.title}</h2>
                <p className="mt-3 max-w-md text-lg text-fg-2">{f.body}</p>
              </div>
              <img src={`/assets/landing/${f.img}.webp`} alt="" loading="lazy" width={1200} height={750} className="w-full rounded-2xl border border-line-strong" />
            </div>
          ))}
        </section>

        <section id="installer" className="mx-auto max-w-6xl px-5 py-20">
          <div data-reveal className="reveal grid items-center gap-10 rounded-3xl bg-surface p-8 sm:p-12 lg:grid-cols-[auto_1fr]">
            <div className="mx-auto rounded-3xl bg-accent p-4">
              <QrCode value={INSTALL_URL} size={220} className="block rounded-2xl" />
            </div>
            <div>
              <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">FEO dans ta poche</h2>
              <p className="mt-3 max-w-md text-lg text-fg-2">Scanne le code avec l'appareil photo de ton téléphone, ou ouvre <a href="/install" className="font-semibold text-accent-fg underline">feo-swart.vercel.app/install</a>.</p>
              <ul className="mt-5 space-y-2 text-fg-2">
                <li><strong className="text-fg">Android</strong> : télécharge et installe l'application.</li>
                <li><strong className="text-fg">iPhone</strong> : ajoute FEO à ton écran d'accueil depuis Safari.</li>
              </ul>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

export function Install() {
  const [os, setOs] = useState<'android' | 'ios' | 'other'>('other');
  useEffect(() => {
    document.title = 'Installer FEO — Android et iPhone';
    const ua = navigator.userAgent;
    setOs(/android/i.test(ua) ? 'android' : /iphone|ipad|ipod/i.test(ua) ? 'ios' : 'other');
  }, []);
  const card = 'rounded-3xl bg-surface p-6 sm:p-8';
  const android = (
    <section key="android" className={card}>
      <h2 className="font-display text-2xl font-extrabold">Android</h2>
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-fg-2">
        <li>Télécharge l'application avec le bouton ci-dessous.</li>
        <li>Ouvre le fichier téléchargé. Si Android le demande, autorise l'installation depuis ton navigateur.</li>
        <li>Lance FEO et connecte-toi.</li>
      </ol>
      <a href={APK_URL} className="mt-6 inline-block rounded-full bg-accent px-7 py-3.5 font-bold text-on-accent transition hover:scale-[1.03]">Télécharger pour Android (APK)</a>
    </section>
  );
  const ios = (
    <section key="ios" className={card}>
      <h2 className="font-display text-2xl font-extrabold">iPhone et iPad</h2>
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-fg-2">
        <li>Ouvre <a href="/" className="font-semibold text-accent-fg underline">feo-swart.vercel.app</a> dans <strong className="text-fg">Safari</strong>.</li>
        <li>Touche le bouton <strong className="text-fg">Partager</strong> (le carré avec une flèche vers le haut).</li>
        <li>Choisis <strong className="text-fg">Sur l'écran d'accueil</strong>, puis <strong className="text-fg">Ajouter</strong>.</li>
      </ol>
      <p className="mt-4 text-sm text-fg-3">FEO s'ouvre alors en plein écran, comme une application.</p>
    </section>
  );
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5">
        <a href="/" aria-label="FEO, accueil"><Logo className="text-3xl" /></a>
        <a href="/login" className="rounded-full px-4 py-2 text-sm font-semibold hover:bg-fg/[0.06]">Se connecter</a>
      </header>
      <main className="mx-auto max-w-3xl space-y-5 px-5 pt-6 pb-16">
        <h1 className="font-display text-5xl font-extrabold tracking-tight">Installer FEO</h1>
        <p className="text-lg text-fg-2">Gratuit, sans passer par un store.</p>
        {os === 'ios' ? [ios, android] : [android, ios]}
        <section className={`${card} hidden items-center gap-6 sm:flex`}>
          <QrCode value={INSTALL_URL} size={130} className="shrink-0 rounded-xl" />
          <p className="text-fg-2">Sur ordinateur ? Scanne ce code avec ton téléphone pour ouvrir cette page.</p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
