// =============================================================================
// Homepage — lucide icon mapping for event modules
// =============================================================================

import {
  CalendarDays,
  FolderOpen,
  Image as ImageIcon,
  Network,
  Terminal,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react"

const ICON_BY_NAME: Record<string, LucideIcon> = {
  terminal: Terminal,
  network: Network,
  "folder-open": FolderOpen,
  image: ImageIcon,
  users: Users,
  wrench: Wrench,
  calendar: CalendarDays,
}

/** Resolve a lucide icon component for an event's iconName. */
export function moduleIconComponent(iconName: string | null): LucideIcon {
  return ICON_BY_NAME[iconName ?? ""] ?? Terminal
}
