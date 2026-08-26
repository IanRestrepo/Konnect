import {
  Bell,
  Bug,
  Calendar,
  Camera,
  ChartLine,
  Clapperboard,
  Coffee,
  Compass,
  DollarSign,
  Flame,
  Folder,
  Gift,
  Hash,
  Handshake,
  Heart,
  Lightbulb,
  Megaphone,
  Music,
  Palette,
  PartyPopper,
  Rocket,
  Scissors,
  Send,
  Sparkles,
  Star,
  Target,
  Trophy,
  Users,
  Video,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * Iconos que se pueden elegir para una sala. Se guarda el nombre, no el
 * componente, así que la lista puede crecer sin tocar lo que ya está guardado.
 */
export const CHAT_ICONS: Record<string, LucideIcon> = {
  hash: Hash,
  megaphone: Megaphone,
  rocket: Rocket,
  sparkles: Sparkles,
  flame: Flame,
  zap: Zap,
  star: Star,
  heart: Heart,
  trophy: Trophy,
  target: Target,
  lightbulb: Lightbulb,
  bell: Bell,
  users: Users,
  handshake: Handshake,
  clapperboard: Clapperboard,
  video: Video,
  camera: Camera,
  scissors: Scissors,
  palette: Palette,
  music: Music,
  chart: ChartLine,
  dollar: DollarSign,
  calendar: Calendar,
  folder: Folder,
  compass: Compass,
  send: Send,
  gift: Gift,
  party: PartyPopper,
  coffee: Coffee,
  bug: Bug,
  wrench: Wrench,
};

export const CHAT_ICON_NAMES = Object.keys(CHAT_ICONS);

/** Devuelve el icono guardado, o la almohadilla si el nombre ya no existe. */
export function chatIcon(name: string | undefined): LucideIcon {
  return CHAT_ICONS[name ?? ""] ?? Hash;
}
