import { KeyRound, Link2, Mail } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../components/ui/Button';
import { Field } from '../components/ui/Field';
import { api, setTokens } from '../lib/api';
import type { OAuthProvider } from '../lib/types';
import { useAuthStore } from '../stores/auth';
import { toast } from '../stores/ui';

const LABEL: Record<OAuthProvider, string> = { google: 'Google', github: 'GitHub' };

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-fg/[0.04] p-5 sm:p-6">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">{icon}{title}</h2>
      {children}
    </section>
  );
}

function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (hasPassword && !current) errs.current = 'Entre ton mot de passe actuel';
    if (next.length < 8) errs.next = 'Au moins 8 caractères';
    else if (confirm !== next) errs.confirm = 'Les deux mots de passe ne correspondent pas';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setLoading(true);
    try {
      const tokens = await api.auth.changePassword(next, hasPassword ? current : undefined);
      // The API signs every other session out and hands this one fresh tokens.
      setTokens(tokens.accessToken, tokens.refreshToken);
      await refreshUser();
      setCurrent(''); setNext(''); setConfirm('');
      toast(hasPassword ? 'Mot de passe modifié. Tes autres appareils ont été déconnectés.' : 'Mot de passe créé', { tone: 'success' });
    } catch (err) {
      const message = (err as Error).message;
      setErrors(/actuel/i.test(message) ? { current: message } : { form: message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="max-w-sm space-y-4" noValidate aria-label={hasPassword ? 'Changer de mot de passe' : 'Créer un mot de passe'}>
      {!hasPassword && (
        <p className="text-sm text-fg-2">Tu te connectes avec Google ou GitHub. Crée un mot de passe pour pouvoir aussi te connecter avec ton email.</p>
      )}
      {hasPassword && <Field id="current-password" label="Mot de passe actuel" type="password" value={current} onChange={setCurrent} autoComplete="current-password" error={errors.current} />}
      <Field id="new-password" label="Nouveau mot de passe" type="password" value={next} onChange={setNext} autoComplete="new-password" error={errors.next} hint="8 caractères minimum" />
      <Field id="confirm-password" label="Confirme-le" type="password" value={confirm} onChange={setConfirm} autoComplete="new-password" error={errors.confirm} />
      {errors.form && <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{errors.form}</p>}
      <Button variant="primary" type="submit" loading={loading}>{hasPassword ? 'Changer le mot de passe' : 'Créer le mot de passe'}</Button>
    </form>
  );
}

export function Account() {
  const user = useAuthStore((s) => s.user);
  if (!user) return null;
  const providers = user.providers ?? [];
  const since = new Date(user.createdAt).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  return (
    <div className="animate-fade-in px-4 pt-2 pb-6 sm:px-8">
      <h1 className="mb-6 font-display text-4xl font-extrabold tracking-tight">Mon compte</h1>
      <div className="grid max-w-3xl gap-4">
        <Section icon={<Mail className="size-5" />} title="Profil">
          <div className="flex items-center gap-4">
            {user.avatarUrl
              ? <img src={user.avatarUrl} alt="" className="size-14 rounded-full object-cover" referrerPolicy="no-referrer" />
              : <span className="grid size-14 place-items-center rounded-full bg-accent text-xl font-bold text-on-accent">{user.displayName[0]?.toUpperCase()}</span>}
            <div className="min-w-0">
              <p className="truncate font-semibold">{user.displayName}</p>
              <p className="truncate text-sm text-fg-2">{user.email}</p>
              <p className="text-xs text-fg-3">Membre depuis {since}</p>
            </div>
          </div>
        </Section>

        <Section icon={<Link2 className="size-5" />} title="Connexions">
          {providers.length ? (
            <ul className="space-y-1 text-sm">
              {providers.map((p) => <li key={p}>Connecté avec <strong>{LABEL[p]}</strong></li>)}
            </ul>
          ) : (
            <p className="text-sm text-fg-2">Aucun compte Google ou GitHub lié.</p>
          )}
          <p className="mt-2 text-xs text-fg-3">Un compte Google ou GitHub qui utilise le même email vérifié est lié automatiquement à la première connexion.</p>
        </Section>

        <Section icon={<KeyRound className="size-5" />} title="Mot de passe">
          <PasswordForm hasPassword={user.hasPassword !== false} />
        </Section>
      </div>
    </div>
  );
}
