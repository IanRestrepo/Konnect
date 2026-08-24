import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function ListBox({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "divide-y divide-[var(--line)] overflow-hidden rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)]",
        className,
      )}
      {...props}
    />
  );
}

export function ListRow({
  href,
  leading,
  title,
  subtitle,
  trailing,
  chevron = true,
  onClick,
  className,
}: {
  href?: string;
  leading?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  trailing?: React.ReactNode;
  chevron?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const body = (
    <>
      {leading}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-medium">{title}</span>
        {subtitle && (
          <span className="mt-0.5 block truncate text-[12px] text-[var(--text-muted)]">
            {subtitle}
          </span>
        )}
      </span>
      {trailing}
      {chevron && href && (
        <ChevronRight size={15} className="shrink-0 text-[var(--text-subtle)]" />
      )}
    </>
  );

  const classes = cn(
    "flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[var(--surface-2)]",
    className,
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {body}
      </Link>
    );
  }
  return onClick ? (
    <button onClick={onClick} className={classes}>
      {body}
    </button>
  ) : (
    <div className={classes}>{body}</div>
  );
}

export function RowIcon({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "grid h-9 w-9 shrink-0 place-items-center rounded-[var(--r-control)] border border-[var(--line)] bg-[var(--surface-2)] text-[var(--text-muted)]",
        className,
      )}
    >
      {children}
    </span>
  );
}
