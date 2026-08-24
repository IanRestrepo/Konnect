import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface-2)] px-6 py-14 text-center">
      <span className="mb-3 grid h-10 w-10 place-items-center rounded-[var(--r-control)] border border-[var(--line)] bg-[var(--surface)] text-[var(--text-subtle)]">
        <Icon size={17} strokeWidth={1.75} />
      </span>
      <p className="text-[14px] font-semibold">{title}</p>
      {description && (
        <p className="mt-1 max-w-xs text-[12.5px] text-[var(--text-muted)]">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
