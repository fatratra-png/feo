import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Logo } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { useAuthStore } from '../stores/auth';
import { coverUrl } from '../lib/api';

const COVERS = ['ZqcdVtEdUYs', 'pRpeEdMmmQ0', 'kJQP7kiw5Fk', 'JGwWNGJdvx8', '6diPY_4iWEA', 'OPf0YbXqDm0', 'TG92mK3mlRs', 'fRh_vgS2dFE', 'hT_nvWreIhg'];

function Field({
  id, label, type = 'text', value, onChange, autoComplete, error, hint,
}: {
  id: string; label: string; type?: string; value: string; onChange: (v: string) => void; autoComplete: string; error?: string; hint?: string;
}) {
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">{label}</label>
      <div className="relative">
        <input
          id={id}
          type={isPassword && show ? 'text' : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className="h-12 w-full rounded-xl border border-line-strong bg-fg/[0.04] px-4 text-base outline-none transition focus:border-accent aria-[invalid=true]:border-danger"
        />
        {isPassword && (
          <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} className="absolute top-1/2 right-2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-fg-3 hover:text-fg">
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        )}
      </div>
      {error ? <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm text-danger">{error}</p> : hint ? <p id={`${id}-hint`} className="mt-1.5 text-xs text-fg-3">{hint}</p> : null}
    </div>
  );
}

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

export function Login() {
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
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
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field id="email" label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
        <Field id="password" label="Mot de passe" type="password" value={password} onChange={setPassword} autoComplete="current-password" />
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
