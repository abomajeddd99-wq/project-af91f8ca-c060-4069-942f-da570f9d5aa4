import { cn } from "@/lib/utils";
import { STATUS_LABELS, type ProgressStatus } from "@/lib/progress";

const styles: Record<ProgressStatus, string> = {
  not_started: "bg-muted text-muted-foreground",
  in_progress: "bg-warning-soft text-warning-foreground",
  completed: "bg-success-soft text-success",
};

export function StatusBadge({ status, className }: { status: ProgressStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        styles[status],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {STATUS_LABELS[status]}
    </span>
  );
}

export function PlaceholderBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-warning/40 bg-warning-soft px-2 py-0.5 text-[11px] font-medium text-warning-foreground",
        className,
      )}
    >
      معيار تجريبي
    </span>
  );
}
