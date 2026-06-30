import {
  Add01Icon,
  Alert02Icon,
  AiBrain01Icon,
  ArrowRight01Icon,
  ArrowTurnBackwardIcon,
  Cancel01Icon,
  CheckmarkBadge01Icon,
  CheckmarkCircle02Icon,
  Delete02Icon,
  File01Icon,
  FlashIcon,
  Folder01Icon,
  GitBranchIcon,
  GitCommitIcon,
  GitPullRequestIcon,
  HelpCircleIcon,
  InformationCircleIcon,
  MagicWand01Icon,
  Message01Icon,
  PencilEdit02Icon,
  PlayIcon,
  RoboticIcon,
  Search01Icon,
  SentIcon,
  Settings02Icon,
  SourceCodeIcon,
  SparklesIcon,
  TaskDaily01Icon,
  ViewIcon,
  Wrench01Icon,
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
  // chat command glyphs
  plan: TaskDaily01Icon,
  instant: FlashIcon,
  execute: PlayIcon,
  ask: HelpCircleIcon,
  continue: ArrowRight01Icon,
  done: CheckmarkBadge01Icon,
  explore: Search01Icon,
  quickfix: Wrench01Icon,
  status: InformationCircleIcon,
  review: ViewIcon,
  undo: ArrowTurnBackwardIcon,
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
