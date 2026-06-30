import {
  Add01Icon,
  Alert02Icon,
  AiBrain01Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Delete02Icon,
  File01Icon,
  Folder01Icon,
  GitBranchIcon,
  GitCommitIcon,
  GitPullRequestIcon,
  MagicWand01Icon,
  Message01Icon,
  PencilEdit02Icon,
  RoboticIcon,
  SentIcon,
  Settings02Icon,
  SourceCodeIcon,
  SparklesIcon,
  ArrowTurnBackwardIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

/**
 * Single icon set for the whole app (HugeIcons). Components reference icons by
 * semantic name so the vocabulary stays consistent — never import glyphs ad hoc.
 */
export const ICONS = {
  projects: Folder01Icon,
  sessions: Message01Icon,
  cockpit: GitBranchIcon,
  agents: SparklesIcon,
  add: Add01Icon,
  rename: PencilEdit02Icon,
  delete: Delete02Icon,
  close: Cancel01Icon,
  send: SentIcon,
  tool: Settings02Icon,
  toolResult: ArrowTurnBackwardIcon,
  error: Alert02Icon,
  success: CheckmarkCircle02Icon,
  pullRequest: GitPullRequestIcon,
  commit: GitCommitIcon,
  branch: GitBranchIcon,
  file: File01Icon,
  skill: MagicWand01Icon,
  agent: RoboticIcon,
  brain: AiBrain01Icon,
  code: SourceCodeIcon,
} as const;

export type IconName = keyof typeof ICONS;

interface IconProps {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function Icon({ name, size = 18, strokeWidth = 1.8, className }: IconProps) {
  return <HugeiconsIcon icon={ICONS[name]} size={size} strokeWidth={strokeWidth} className={className} />;
}
