import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Logo } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { Field } from '../components/ui/Field';
import { useAuthStore } from '../stores/auth';
import { api, coverUrl } from '../lib/api';
import type { AuthProviders, OAuthProvider } from '../lib/types';

const COVERS = ['ZqcdVtEdUYs', 'pRpeEdMmmQ0', 'kJQP7kiw5Fk', 'JGwWNGJdvx8', '6diPY_4iWEA', 'OPf0YbXqDm0', 'TG92mK3mlRs', 'fRh_vgS2dFE', 'hT_nvWreIhg'];

function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="relative grid min-h-dvh lg:grid-cols-2">
      <div className="relative hidden overflow-hidden lg:block" aria-hidden>
        <div className="absolute inset-0 grid grid-cols-3 gap-3 p-3 opacity-70">
          {COVERS.map((id, i) => (
            <img key={id} src={coverUrl(id)} alt="" className={`h-full w-full rounded-2xl object-cover ${i % 2 ? 'translate-y-8' : ''}`} />
          ))}
        </div>
        <div className="absolute inset-0 bg-[linear-gradient(to_right,transparent,var(--color-bg)),radial-gradient(circle_at_30%_30%,color-mix(in_oklab,var(--accent)_45%,transparent),transparent_60%)]" />
        <div className="absolute bottom-12 left-12 max-w-sm">
          <p className="font-display text-4xl leading-tight font-extrabold">Toute la musique.<br />Une IA qui te connaît.</p>
        </div>
      </div>
      <div className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm animate-fade-up">
          <Logo className="text-4xl" />
          <h1 className="mt-8 font-display text-3xl font-bold">{title}</h1>
          <p className="mt-1.5 text-fg-2">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9Z" />
    </svg>
  );
}

function GitHubLogo() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
      <path d="M12 .5a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.1c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.6 18.3 5 18.3 5c.7 1.7.3 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .5Z" />
    </svg>
  );
}

const PROVIDER_LABEL: Record<OAuthProvider, string> = { google: 'Google', github: 'GitHub' };

/** Which sign-in options the API offers (Google/GitHub only once their apps are configured). */
function useAuthProviders() {
  const [providers, setProviders] = useState<AuthProviders | null>(null);
  useEffect(() => {
    let alive = true;
    api.auth.providers().then((p) => alive && setProviders(p)).catch(() => undefined);
    return () => { alive = false; };
  }, []);
  return providers;
}

function OAuthButtons({ providers }: { providers: AuthProviders | null }) {
  const enabled = (['google', 'github'] as const).filter((p) => providers?.[p]);
  if (!enabled.length) return null;
  return (
    <>
      <div className="space-y-3">
        {enabled.map((p) => (
          <a
            key={p}
            href={api.auth.oauthStartUrl(p)}
            className="flex h-12 w-full items-center justify-center gap-3 rounded-full border border-line-strong font-semibold transition hover:bg-fg/[0.06]"
          >
            {p === 'google' ? <GoogleLogo /> : <GitHubLogo />}
            Continuer avec {PROVIDER_LABEL[p]}
          </a>
        ))}
      </div>
      <div className="my-6 flex items-center gap-3 text-xs text-fg-3" role="separator">
        <span className="h-px flex-1 bg-line-strong" />ou avec ton email<span className="h-px flex-1 bg-line-strong" />
      </div>
    </>
  );
}

export function Login() {
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();
  const providers = useAuthProviders();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // A failed Google/GitHub login comes back here with ?error=…
  const [error, setError] = useState<string | null>(params.get('error'));
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return setError('Renseigne ton email et ton mot de passe');
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Content de te revoir" subtitle="Connecte-toi pour retrouver ta musique.">
      <OAuthButtons providers={providers} />
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field id="email" label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
        <Field id="password" label="Mot de passe" type="password" value={password} onChange={setPassword} autoComplete="current-password" />
        <p className="-mt-1 text-right text-sm">
          <Link to="/forgot-password" state={{ email }} className="font-semibold text-accent-fg hover:underline">Mot de passe oublié ?</Link>
        </p>
        {error && <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}
        <Button variant="primary" size="lg" type="submit" loading={loading} className="w-full">Se connecter</Button>
      </form>
      <p className="mt-6 text-center text-sm text-fg-2">
        Pas encore de compte ? <Link to="/register" className="font-semibold text-accent-fg hover:underline">Créer un compte</Link>
      </p>
    </AuthLayout>
  );
}

export function Register() {
  const register = useAuthStore((s) => s.register);
  const navigate = useNavigate();
  const providers = useAuthProviders();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (name.trim().length < 2) next.name = 'Au moins 2 caractères';
    if (!/^\S+@\S+\.\S+$/.test(email)) next.email = 'Email invalide';
    if (password.length < 8) next.password = 'Au moins 8 caractères';
    setErrors(next);
    if (Object.keys(next).length) return document.getElementById(Object.keys(next)[0])?.focus();
    setLoading(true);
    try {
      await register(email, password, name);
      navigate('/', { replace: true });
    } catch (err) {
      setErrors({ form: (err as Error).message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Crée ton compte" subtitle="Gratuit. Ta musique, tes playlists, ton IA.">
      <OAuthButtons providers={providers} />
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field id="name" label="Ton prénom" value={name} onChange={setName} autoComplete="given-name" error={errors.name} />
        <Field id="email" label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" error={errors.email} />
        <Field id="password" label="Mot de passe" type="password" value={password} onChange={setPassword} autoComplete="new-password" error={errors.password} hint="8 caractères minimum" />
        {errors.form && <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{errors.form}</p>}
        <Button variant="primary" size="lg" type="submit" loading={loading} className="w-full">Créer mon compte</Button>
      </form>
      <p className="mt-6 text-center text-sm text-fg-2">
        Déjà inscrit ? <Link to="/login" className="font-semibold text-accent-fg hover:underline">Se connecter</Link>
      </p>
    </AuthLayout>
  );
}

export function ForgotPassword() {
  const location = useNavigateState<{ email?: string }>();
  const [email, setEmail] = useState(location?.email ?? '');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Email invalide');
    setLoading(true);
    setError(null);
    try {
      await api.auth.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthLayout title="Vérifie ta boîte mail" subtitle={`Si un compte existe pour ${email}, tu vas recevoir un lien pour choisir un nouveau mot de passe.`}>
        <p className="text-sm text-fg-2">Le lien est valable 1 heure. Pense à regarder dans les spams.</p>
        <p className="mt-6 text-center text-sm">
          <Link to="/login" className="font-semibold text-accent-fg hover:underline">Retour à la connexion</Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Mot de passe oublié" subtitle="Donne ton email, on t'envoie un lien pour en choisir un nouveau.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field id="email" label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" error={error ?? undefined} />
        <Button variant="primary" size="lg" type="submit" loading={loading} className="w-full">Envoyer le lien</Button>
      </form>
      <p className="mt-6 text-center text-sm text-fg-2">
        Tu t'en souviens ? <Link to="/login" className="font-semibold text-accent-fg hover:underline">Se connecter</Link>
      </p>
    </AuthLayout>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (password.length < 8) next.password = 'Au moins 8 caractères';
    else if (confirm !== password) next.confirm = 'Les deux mots de passe ne correspondent pas';
    setErrors(next);
    if (Object.keys(next).length) return;
    setLoading(true);
    try {
      setSession(await api.auth.resetPassword(token, password));
      navigate('/', { replace: true });
    } catch (err) {
      setErrors({ form: (err as Error).message });
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthLayout title="Lien incomplet" subtitle="Ce lien de réinitialisation n'est pas valide.">
        <Link to="/forgot-password" className="font-semibold text-accent-fg hover:underline">Demander un nouveau lien</Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Nouveau mot de passe" subtitle="Choisis-en un que tu n'utilises pas ailleurs.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field id="password" label="Nouveau mot de passe" type="password" value={password} onChange={setPassword} autoComplete="new-password" error={errors.password} hint="8 caractères minimum" />
        <Field id="confirm" label="Confirme-le" type="password" value={confirm} onChange={setConfirm} autoComplete="new-password" error={errors.confirm} />
        {errors.form && (
          <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
            {errors.form} <Link to="/forgot-password" className="font-semibold underline">Nouveau lien</Link>
          </p>
        )}
        <Button variant="primary" size="lg" type="submit" loading={loading} className="w-full">Enregistrer et me connecter</Button>
      </form>
    </AuthLayout>
  );
}

/** Google/GitHub send the browser here (via the API) with a one-time code. */
export function OAuthCallback() {
  const [params] = useSearchParams();
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // StrictMode runs effects twice; the code is single-use
    started.current = true;
    const code = params.get('code');
    const fail = (message: string) => { void navigate(`/login?error=${encodeURIComponent(message)}`, { replace: true }); };
    if (!code) { fail(params.get('error') || 'Connexion impossible, réessaie.'); return; }
    api.auth.oauthExchange(code)
      .then((session) => { setSession(session); navigate('/', { replace: true }); })
      .catch((err) => fail((err as Error).message));
  }, [params, navigate, setSession]);

  return (
    <div className="grid min-h-dvh place-items-center" role="status" aria-label="Connexion en cours">
      <Logo className="animate-pulse text-5xl" />
    </div>
  );
}

function useNavigateState<T>() {
  return (useLocation().state ?? null) as T | null;
}
