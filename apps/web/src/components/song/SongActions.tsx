import { Heart, ListEnd, ListPlus, MoreHorizontal, Radio, CornerDownRight, Search, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLikedIds, useToggleLike } from '../../hooks/library';
import { cn } from '../../lib/format';
import type { Song } from '../../lib/types';
import { usePlayerStore } from '../../stores/player';
import { toast, useUiStore } from '../../stores/ui';
import { IconButton } from '../ui/Button';
import { Cover } from '../ui/Cover';
import { Menu, type MenuItem } from '../ui/Menu';
import { api } from '../../lib/api';

export function LikeButton({ song, size = 'sm', className }: { song: Song; size?: 'sm' | 'md'; className?: string }) {
  const liked = useLikedIds().has(song.id);
  const toggle = useToggleLike();
  return (
    <IconButton
      label={liked ? 'Retirer des titres likés' : 'Ajouter aux titres likés'}
      aria-pressed={liked}
      size={size}
      className={cn(liked && '!text-accent-fg', className)}
      onClick={(e) => { e.stopPropagation(); toggle.mutate({ song, liked: !liked }); }}
    >
      <Heart className={cn(size === 'md' ? 'size-6' : 'size-[18px]', liked && 'fill-current')} />
    </IconButton>
  );
}

/** "⋯" menu shared by every song row, card and the player. */
export function SongMenu({
  song,
  extra = [],
  onRemove,
  removeLabel = 'Retirer de cette playlist',
  className,
}: {
  song: Song;
  extra?: (MenuItem | 'divider')[];
  onRemove?: () => void;
  removeLabel?: string;
  className?: string;
}) {
  const navigate = useNavigate();
  const liked = useLikedIds().has(song.id);
  const toggleLike = useToggleLike();
  const openAddToPlaylist = useUiStore((s) => s.openAddToPlaylist);
  const mainArtist = song.artist.split(',')[0];

  const startRadio = async () => {
    toast(`Radio « ${song.title} » en préparation…`);
    try {
      const res = await api.radio([song], [], false, 20);
      usePlayerStore.getState().playSongs([song, ...res.songs], 0, { label: `Radio · ${song.title}` });
    } catch (err) {
      toast((err as Error).message, { tone: 'error' });
    }
  };

  const items: (MenuItem | 'divider')[] = [
    { label: 'Lire ensuite', icon: <CornerDownRight />, onSelect: () => { usePlayerStore.getState().playNext(song); toast('Lecture juste après le titre en cours'); } },
    { label: "Ajouter à la file d'attente", icon: <ListEnd />, onSelect: () => { usePlayerStore.getState().addToQueue([song]); toast("Ajouté à la file d'attente"); } },
    { label: 'Ajouter à une playlist', icon: <ListPlus />, onSelect: () => openAddToPlaylist([song]) },
    { label: liked ? 'Retirer des titres likés' : 'Ajouter aux titres likés', icon: <Heart />, onSelect: () => toggleLike.mutate({ song, liked: !liked }) },
    'divider',
    { label: 'Lancer la radio du titre', icon: <Radio />, onSelect: startRadio },
    { label: `Plus de ${mainArtist}`, icon: <Search />, onSelect: () => navigate(`/search?q=${encodeURIComponent(mainArtist)}`) },
    ...(extra.length ? (['divider', ...extra] as (MenuItem | 'divider')[]) : []),
    ...(onRemove ? (['divider', { label: removeLabel, icon: <Trash2 />, onSelect: onRemove, danger: true }] as (MenuItem | 'divider')[]) : []),
  ];

  return (
    <Menu
      header={
        <div className="flex items-center gap-3">
          <Cover id={song.id} className="size-10" rounded="rounded-md" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{song.title}</p>
            <p className="truncate text-xs text-fg-2">{song.artist}</p>
          </div>
        </div>
      }
      items={items}
      trigger={(props) => (
        <IconButton label={`Plus d'options pour ${song.title}`} size="sm" className={className} {...props}>
          <MoreHorizontal className="size-5" />
        </IconButton>
      )}
    />
  );
}

export const moveActions = (index: number, total: number, move: (from: number, to: number) => void): MenuItem[] => [
  { label: 'Monter', icon: <ArrowUp />, disabled: index === 0, onSelect: () => move(index, index - 1) },
  { label: 'Descendre', icon: <ArrowDown />, disabled: index >= total - 1, onSelect: () => move(index, index + 1) },
];
