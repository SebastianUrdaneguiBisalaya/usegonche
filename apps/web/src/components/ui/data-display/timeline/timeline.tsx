"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Icon } from "../../foundations/icon/icon";
import { cn } from "../../utils/tailwind/cn";

const toneClassNames = {
  default: "bg-muted-foreground",
  destructive: "bg-destructive",
  success: "bg-success",
  warning: "bg-warning",
} as const;

export type TimelineTone = keyof typeof toneClassNames;

/** Pill-badge className per tone — the badge counterpart of `toneClassNames`' timeline dot colors. */
export const STATUS_BADGE_CLASSNAME: Record<TimelineTone, string> = {
  default: "bg-muted text-muted-foreground",
  destructive: "bg-destructive/10 text-destructive",
  success: "bg-success/10 text-success",
  warning: "bg-warning/15 text-warning",
};

export interface TimelineRootProps {
  readonly children: ReactNode;
  readonly className?: string;
}

/** Vertical list of timestamped events, connected by a rule. */
function TimelineRoot({ children, className }: TimelineRootProps) {
  return (
    <ol
      className={cn(
        "flex flex-col gap-6 border-l-2 border-border pl-6",
        className,
      )}
    >
      {children}
    </ol>
  );
}

export interface TimelineItemProps {
  /** Event title. */
  readonly title: ReactNode;
  /** Timestamp shown at the trailing edge of the title row. */
  readonly time?: ReactNode;
  /** Icon rendered inside the timeline dot. */
  readonly icon?: LucideIcon;
  /**
   * Semantic tone of the dot (and, via `STATUS_BADGE_CLASSNAME`, any status badge
   * paired with this event).
   * @default "default"
   */
  readonly tone?: TimelineTone;
  /** Supporting detail rendered below the title. */
  readonly children?: ReactNode;
  readonly className?: string;
}

/** One event on the timeline. */
function TimelineItem({
  title,
  time,
  icon,
  tone = "default",
  children,
  className,
}: TimelineItemProps) {
  return (
    <li className={cn("relative", className)}>
      <span
        className={cn(
          "absolute -left-8.25 top-0.5 flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-background",
          toneClassNames[tone],
        )}
      >
        {icon && (
          <Icon
            className="text-background"
            icon={icon}
            size="xs"
          />
        )}
      </span>
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-1">
          <p className="text-sm font-semibold font-primary text-foreground">
            {title}
          </p>
          {time && (
            <time className="shrink-0 text-xs font-primary text-muted-foreground">
              {time}
            </time>
          )}
        </div>
        {children && (
          <div className="text-sm font-primary text-foreground-secondary">
            {children}
          </div>
        )}
      </div>
    </li>
  );
}

/**
 * Compound timeline.
 * @example
 * ```tsx
 * <Timeline>
 *   <Timeline.Item title="Order placed" time="10:32 AM" tone="success" />
 * </Timeline>
 * ```
 */
export const Timeline = Object.assign(TimelineRoot, {
  Item: TimelineItem,
});
