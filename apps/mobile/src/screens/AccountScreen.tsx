import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Field, IconButton, T } from '../components/ui';
import { api, setTokens } from '../lib/api';
import type { OAuthProvider } from '../lib/types';
import { useAuthStore } from '../stores/auth';
import { toast } from '../stores/ui';
import { useTheme } from '../theme/ThemeProvider';
import { font, radius } from '../theme/tokens';

const LABEL: Record<OAuthProvider, string> = { google: 'Google', github: 'GitHub' };

function Section({ icon, title, children }: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; children: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ backgroundColor: c.overlay, borderRadius: radius.lg, padding: 18, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name={icon} size={20} color={c.fg} />
        <T size={17} weight="700" accessibilityRole="header">{title}</T>
      </View>
      {children}
    </View>
  );
}

function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const submit = async () => {
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
      await setTokens(tokens.accessToken, tokens.refreshToken);
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
    <View style={{ gap: 14 }}>
      {!hasPassword && (
        <T tone="fg2" size={14}>Tu te connectes avec Google ou GitHub. Crée un mot de passe pour pouvoir aussi te connecter avec ton email.</T>
      )}
      {hasPassword && (
        <Field label="Mot de passe actuel" value={current} onChangeText={setCurrent} secureTextEntry autoComplete="current-password" textContentType="password" error={errors.current} />
      )}
      <Field label="Nouveau mot de passe" value={next} onChangeText={setNext} secureTextEntry autoComplete="new-password" textContentType="newPassword" error={errors.next} hint="8 caractères minimum" />
      <Field label="Confirme-le" value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" textContentType="newPassword" error={errors.confirm} onSubmitEditing={submit} />
      {errors.form ? <T tone="danger" size={14} accessibilityLiveRegion="polite">{errors.form}</T> : null}
      <Button label={hasPassword ? 'Changer le mot de passe' : 'Créer le mot de passe'} variant="primary" loading={loading} onPress={submit} />
    </View>
  );
}

export function AccountScreen({ navigation }: any) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  if (!user) return null;
  const providers = user.providers ?? [];
  const since = new Date(user.createdAt).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        <IconButton icon="chevron-back" size={26} label="Retour" onPress={() => navigation.goBack()} style={{ marginTop: insets.top + 6, marginLeft: 4 }} />
        <View style={{ paddingHorizontal: 20, gap: 16 }}>
          <T size={32} style={font.title} accessibilityRole="header">Mon compte</T>

          <Section icon="person-circle-outline" title="Profil">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              {user.avatarUrl ? (
                <Image source={{ uri: user.avatarUrl }} style={{ width: 56, height: 56, borderRadius: 28 }} accessibilityIgnoresInvertColors />
              ) : (
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
                  <T size={22} weight="800" tone="onAccent">{user.displayName[0]?.toUpperCase()}</T>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <T size={16} weight="700" numberOfLines={1}>{user.displayName}</T>
                <T tone="fg2" size={14} numberOfLines={1}>{user.email}</T>
                <T tone="fg3" size={12}>Membre depuis {since}</T>
              </View>
            </View>
          </Section>

          <Section icon="link-outline" title="Connexions">
            {providers.length
              ? providers.map((p) => <T key={p} size={14}>Connecté avec <T size={14} weight="700">{LABEL[p]}</T></T>)
              : <T tone="fg2" size={14}>Aucun compte Google ou GitHub lié.</T>}
            <T tone="fg3" size={12}>Un compte Google ou GitHub qui utilise le même email vérifié est lié automatiquement à la première connexion.</T>
          </Section>

          <Section icon="key-outline" title="Mot de passe">
            <PasswordForm hasPassword={user.hasPassword !== false} />
          </Section>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
