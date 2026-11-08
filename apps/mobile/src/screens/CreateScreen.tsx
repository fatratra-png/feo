import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CreatePlaylistSheet } from '../components/sheets';
import { SongList } from '../components/song';
import { Button, Chip, IconButton, Mosaic, PlayButton, T } from '../components/ui';
import { api } from '../lib/api';
import { formatTotal } from '../lib/format';
import type { GeneratedPlaylist } from '../lib/types';
import { usePlayerStore } from '../stores/player';
import { useTheme } from '../theme/ThemeProvider';
import { font, radius } from '../theme/tokens';

const IDEAS = ['Soirée chill malgache des années 2000', 'Afrobeats et amapiano pour faire la fête', 'Musique douce pour travailler', 'Salegy et tsapiky pour danser', 'Gospel apaisant pour le dimanche'];
const STEPS = ['Analyse de ta demande', 'Sélection des titres par l’IA', 'Vérification sur YouTube', 'Mise en ordre'];

function Progress() {
  const { c } = useTheme();
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timers = [3500, 12000, 22000].map((ms, i) => setTimeout(() => setStep(i + 1), ms));
    return () => timers.forEach(clearTimeout);
  }, []);
  return (
    <View style={{ padding: 18, borderRadius: radius.lg, backgroundColor: c.surface, gap: 12 }} accessibilityLiveRegion="polite">
      <T size={16} weight="800">L'IA compose ta playlist…</T>
      <T tone="fg2" size={13}>En général 20 à 40 secondes.</T>
      {STEPS.map((label, i) => (
        <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {i < step ? <Ionicons name="checkmark-circle" size={20} color={c.accentFg} /> : i === step ? <ActivityIndicator size="small" color={c.accentFg} /> : <Ionicons name="ellipse-outline" size={20} color={c.fg3} />}
          <T size={14} tone={i <= step ? 'fg' : 'fg3'}>{label}</T>
        </View>
      ))}
    </View>
  );
}

export function CreateScreen({ route }: any) {
  const { c, name } = useTheme();
  const insets = useSafeAreaInsets();
  const [prompt, setPrompt] = useState('');
  const [count, setCount] = useState(20);
  const [result, setResult] = useState<(GeneratedPlaylist & { prompt: string }) | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const ctxLabel = usePlayerStore((s) => s.context?.label);
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  const generate = useMutation({
    mutationFn: (p: string) => api.generatePlaylist(p, count),
    onSuccess: (data, p) => { setResult({ ...data, prompt: p }); setSavedId(null); },
  });

  const submit = (p = prompt) => {
    const text = p.trim();
    if (text.length < 3) return;
    setPrompt(text);
    generate.mutate(text);
  };

  // Arriving from the home prompt bar.
  useEffect(() => {
    const p = route.params?.prompt;
    if (p) submit(p);
  }, [route.params?.prompt]);

  const context = result ? { label: result.name } : null;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>
      <LinearGradient colors={[name === 'dark' ? '#4a3d0c' : '#fbe58a', c.bg]} style={{ paddingTop: insets.top + 16, paddingHorizontal: 16, paddingBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="sparkles" size={14} color={c.accentFg} />
          <T size={12} weight="800" tone="accentFg" style={{ textTransform: 'uppercase' }}>Studio IA</T>
        </View>
        <T size={28} style={[font.display, { marginTop: 8 }]} accessibilityRole="header">Décris un moment, l'IA en fait une playlist.</T>

        <View style={{ marginTop: 18, backgroundColor: c.surface, borderRadius: radius.lg, padding: 12, gap: 12 }}>
          <TextInput
            value={prompt}
            onChangeText={setPrompt}
            multiline
            maxLength={300}
            placeholder="ex. Une soirée entre amis à Tana, salegy et afro, qui monte en énergie"
            placeholderTextColor={c.fg3}
            accessibilityLabel="Ta demande"
            style={{ minHeight: 64, color: c.fg, fontSize: 16, textAlignVertical: 'top' }}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <View style={{ flexDirection: 'row', gap: 6 }} accessibilityRole="radiogroup" accessibilityLabel="Nombre de titres">
              {[10, 20, 30].map((n) => <Chip key={n} label={`${n}`} active={count === n} onPress={() => setCount(n)} />)}
            </View>
            <Button label={result ? 'Regénérer' : 'Générer'} variant="primary" icon="sparkles" size="sm" loading={generate.isPending} disabled={prompt.trim().length < 3} onPress={() => submit()} />
          </View>
        </View>
        {!result && !generate.isPending && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
            {IDEAS.map((idea) => <Chip key={idea} label={idea} onPress={() => submit(idea)} />)}
          </View>
        )}
      </LinearGradient>

      <View style={{ paddingHorizontal: 16 }}>
        {generate.isPending ? (
          <Progress />
        ) : generate.error ? (
          <View style={{ padding: 16, borderRadius: radius.lg, backgroundColor: c.overlay, gap: 10 }} accessibilityRole="alert">
            <T tone="danger" size={15} weight="700">La génération a échoué</T>
            <T tone="fg2" size={13}>{(generate.error as Error).message}</T>
            <Button label="Réessayer" icon="refresh" onPress={() => submit()} />
          </View>
        ) : result ? (
          <View>
            {result.model === 'fallback' && (
              <View style={{ padding: 12, borderRadius: radius.md, backgroundColor: c.overlay, marginBottom: 14 }}>
                <T tone="fg2" size={13}>L'IA est saturée : sélection basée sur une recherche. Réessaie plus tard pour une vraie curation IA.</T>
              </View>
            )}
            <View style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-end' }}>
              <Mosaic ids={result.songs.slice(0, 4).map((s) => s.id)} size={112} />
              <View style={{ flex: 1 }}>
                <T size={11} weight="800" tone="accentFg" style={{ textTransform: 'uppercase' }}>{result.model === 'fallback' ? 'Sélection' : 'Proposition de l’IA'}</T>
                <T size={22} style={[font.title, { marginTop: 4 }]}>{result.name}</T>
                <T tone="fg2" size={12} style={{ marginTop: 4 }}>{result.songs.length} titres · {formatTotal(result.songs.reduce((n, s) => n + s.duration, 0))}</T>
              </View>
            </View>
            {result.description ? <T tone="fg2" size={13} style={{ marginTop: 10 }}>{result.description}</T> : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 }}>
              <PlayButton
                playing={ctxLabel === result.name && isPlaying}
                onPress={() => (ctxLabel === result.name ? usePlayerStore.getState().togglePlay() : usePlayerStore.getState().playSongs(result.songs, 0, context))}
              />
              <IconButton icon="shuffle" size={26} label="Lecture aléatoire" onPress={() => usePlayerStore.getState().playShuffled(result.songs, context)} />
              {savedId ? <Button label="Enregistrée" icon="checkmark" disabled onPress={() => undefined} size="sm" /> : <Button label="Enregistrer" icon="bookmark-outline" size="sm" onPress={() => setSaving(true)} />}
            </View>
            <View style={{ marginTop: 12 }}>
              <SongList songs={result.songs} context={context} showReason />
            </View>
            <CreatePlaylistSheet
              visible={saving}
              onClose={() => setSaving(false)}
              initialSongs={result.songs}
              initialName={result.name}
              description={result.description}
              aiPrompt={result.model === 'fallback' ? undefined : result.prompt}
              onCreated={setSavedId}
            />
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}
