import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Field, Logo, Press, T } from '../components/ui';
import { useAuthStore } from '../stores/auth';
import { useTheme } from '../theme/ThemeProvider';
import { font } from '../theme/tokens';

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
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" />
      <Field label="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" textContentType="password" onSubmitEditing={submit} />
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
      <Field label="Ton prénom" value={name} onChangeText={setName} autoComplete="given-name" error={errors.name} />
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" error={errors.email} />
      <Field label="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" error={errors.password} hint="8 caractères minimum" />
      {errors.form ? <T tone="danger" size={14} accessibilityLiveRegion="polite">{errors.form}</T> : null}
      <Button label="Créer mon compte" variant="primary" loading={loading} onPress={submit} />
    </AuthLayout>
  );
}
