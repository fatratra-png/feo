import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { api, OAUTH_RETURN_URL } from '../lib/api';
import type { AuthProviders, OAuthProvider } from '../lib/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Field, Logo, Press, T } from '../components/ui';
import { useAuthStore } from '../stores/auth';
import { useTheme } from '../theme/ThemeProvider';
import { font, radius } from '../theme/tokens';

function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle: string; children: React.ReactNode; footer: React.ReactNode }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }}>
        <Logo size={44} />
        <T size={28} style={[font.title, { marginTop: 28 }]} accessibilityRole="header">{title}</T>
        <T tone="fg2" size={15} style={{ marginTop: 6, marginBottom: 28 }}>{subtitle}</T>
        <View style={{ gap: 16 }}>{children}</View>
        <View style={{ marginTop: 24, alignItems: 'center' }}>{footer}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Reads one query parameter from a deep link (URLSearchParams is incomplete on some RN versions). */
function param(url: string, name: string) {
  const m = url.match(new RegExp(`[?&]${name}=([^&#]*)`));
  return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : null;
}

const PROVIDERS: { id: OAuthProvider; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { id: 'google', label: 'Continuer avec Google', icon: 'logo-google' },
  { id: 'github', label: 'Continuer avec GitHub', icon: 'logo-github' },
];

/**
 * "Continue with Google / GitHub": the API runs the OAuth dance in an
 * in-app browser and comes back to feo://auth with a one-time code.
 */
function OAuthButtons({ onError }: { onError: (message: string | null) => void }) {
  const { c } = useTheme();
  const setSession = useAuthStore((s) => s.setSession);
  const [providers, setProviders] = useState<AuthProviders | null>(null);
  const [busy, setBusy] = useState<OAuthProvider | null>(null);

  useEffect(() => {
    let alive = true;
    api.auth.providers().then((p) => alive && setProviders(p)).catch(() => undefined);
    return () => { alive = false; };
  }, []);

  const enabled = PROVIDERS.filter((p) => providers?.[p.id]);
  if (!enabled.length) return null;

  const start = async (provider: OAuthProvider) => {
    setBusy(provider);
    onError(null);
    try {
      const result = await WebBrowser.openAuthSessionAsync(api.auth.oauthStartUrl(provider), OAUTH_RETURN_URL);
      if (result.type !== 'success') return; // closed by the user
      const code = param(result.url, 'code');
      if (!code) return onError(param(result.url, 'error') || 'Connexion impossible, réessaie.');
      await setSession(await api.auth.oauthExchange(code));
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={{ gap: 12 }}>
      {enabled.map((p) => (
        <Button key={p.id} label={p.label} icon={p.icon} variant="secondary" loading={busy === p.id} disabled={busy !== null} onPress={() => void start(p.id)} />
      ))}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 4 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={{ flex: 1, height: 1, backgroundColor: c.lineStrong, borderRadius: radius.full }} />
        <T tone="fg3" size={12}>ou avec ton email</T>
        <View style={{ flex: 1, height: 1, backgroundColor: c.lineStrong, borderRadius: radius.full }} />
      </View>
    </View>
  );
}

export function LoginScreen({ navigation }: any) {
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email || !password) return setError('Renseigne ton email et ton mot de passe');
    setLoading(true);
    setError(null);
    try { await login(email.trim(), password); } catch (err) { setError((err as Error).message); } finally { setLoading(false); }
  };

  return (
    <AuthLayout
      title="Content de te revoir"
      subtitle="Connecte-toi pour retrouver ta musique."
      footer={
        <Press onPress={() => navigation.navigate('Register')} accessibilityRole="link">
          <T tone="fg2" size={14}>Pas encore de compte ? <T tone="accentFg" size={14} weight="700">Créer un compte</T></T>
        </Press>
      }
    >
      <OAuthButtons onError={setError} />
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" />
      <Field label="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" textContentType="password" onSubmitEditing={submit} />
      <Press onPress={() => navigation.navigate('ForgotPassword', { email })} accessibilityRole="link" style={{ alignSelf: 'flex-end' }}>
        <T tone="accentFg" size={14} weight="700">Mot de passe oublié ?</T>
      </Press>
      {error ? <T tone="danger" size={14} accessibilityLiveRegion="polite">{error}</T> : null}
      <Button label="Se connecter" variant="primary" loading={loading} onPress={submit} />
    </AuthLayout>
  );
}

export function RegisterScreen({ navigation }: any) {
  const register = useAuthStore((s) => s.register);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const next: Record<string, string> = {};
    if (name.trim().length < 2) next.name = 'Au moins 2 caractères';
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = 'Email invalide';
    if (password.length < 8) next.password = 'Au moins 8 caractères';
    setErrors(next);
    if (Object.keys(next).length) return;
    setLoading(true);
    try { await register(email.trim(), password, name.trim()); } catch (err) { setErrors({ form: (err as Error).message }); } finally { setLoading(false); }
  };

  return (
    <AuthLayout
      title="Crée ton compte"
      subtitle="Gratuit. Ta musique, tes playlists, ton IA."
      footer={
        <Press onPress={() => navigation.goBack()} accessibilityRole="link">
          <T tone="fg2" size={14}>Déjà inscrit ? <T tone="accentFg" size={14} weight="700">Se connecter</T></T>
        </Press>
      }
    >
      <OAuthButtons onError={(message) => setErrors(message ? { form: message } : {})} />
      <Field label="Ton prénom" value={name} onChangeText={setName} autoComplete="given-name" error={errors.name} />
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" error={errors.email} />
      <Field label="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" error={errors.password} hint="8 caractères minimum" />
      {errors.form ? <T tone="danger" size={14} accessibilityLiveRegion="polite">{errors.form}</T> : null}
      <Button label="Créer mon compte" variant="primary" loading={loading} onPress={submit} />
    </AuthLayout>
  );
}

export function ForgotPasswordScreen({ navigation, route }: any) {
  const [email, setEmail] = useState<string>(route.params?.email ?? '');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Email invalide');
    setLoading(true);
    setError(null);
    try {
      await api.auth.forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const back = (
    <Press onPress={() => navigation.goBack()} accessibilityRole="link">
      <T tone="accentFg" size={14} weight="700">Retour à la connexion</T>
    </Press>
  );

  if (sent) {
    return (
      <AuthLayout title="Vérifie ta boîte mail" subtitle={`Si un compte existe pour ${email.trim()}, tu vas recevoir un lien pour choisir un nouveau mot de passe.`} footer={back}>
        <T tone="fg2" size={14}>Le lien est valable 1 heure et s'ouvre dans ton navigateur. Une fois le mot de passe changé, reviens ici pour te connecter. Pense à regarder dans les spams.</T>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Mot de passe oublié" subtitle="Donne ton email, on t'envoie un lien pour en choisir un nouveau." footer={back}>
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" error={error ?? undefined} onSubmitEditing={submit} />
      <Button label="Envoyer le lien" variant="primary" loading={loading} onPress={submit} />
    </AuthLayout>
  );
}
