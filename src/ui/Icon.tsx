import type { ComponentType } from 'preact';
import {
  ArrowLeft, X, Check, Search, Plus, Settings, Play, Ellipsis, Trash2, Pencil, FileText, Download,
  ExternalLink, Camera, CameraOff, PenLine, Highlighter, Eraser, Undo2, Redo2, Crop, Files,
  SquareSplitVertical, Sun, Moon, Info, TriangleAlert, Keyboard, RefreshCw, Music, WifiOff, ChevronRight, Share,
} from 'lucide-preact';

type LucideLike = ComponentType<{ size?: number; strokeWidth?: number; absoluteStrokeWidth?: boolean; class?: string; 'aria-hidden'?: string }>;

const MAP = {
  back: ArrowLeft, close: X, check: Check, search: Search, plus: Plus, settings: Settings, play: Play,
  more: Ellipsis, trash: Trash2, edit: Pencil, file: FileText, download: Download, external: ExternalLink,
  camera: Camera, cameraOff: CameraOff, pen: PenLine, highlighter: Highlighter, eraser: Eraser,
  undo: Undo2, redo: Redo2, crop: Crop, pages: Files, half: SquareSplitVertical, sun: Sun, moon: Moon,
  info: Info, alert: TriangleAlert, keyboard: Keyboard, refresh: RefreshCw, music: Music, wifiOff: WifiOff,
  chevronRight: ChevronRight, share: Share,
} as const;

export type IconName = keyof typeof MAP;
export const ICON_NAMES = Object.keys(MAP) as IconName[];

export interface IconProps {
  name: IconName;
  size?: number;
  class?: string;
}

export function Icon({ name, size = 24, class: cls }: IconProps) {
  const Cmp = MAP[name] as unknown as LucideLike;
  return <Cmp size={size} strokeWidth={1.5} class={`ui-icon${cls ? ` ${cls}` : ''}`} aria-hidden="true" />;
}
