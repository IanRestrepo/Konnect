import { cn } from "@/lib/utils";

export function DefList({ className, ...props }: React.HTMLAttributes<HTMLDListElement>) {
  return <dl className={cn("divide-y divide-[var(--line)]", className)} {...props} />;
}

export function DefRow({
  label,
  children,
  className,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-11 items-center justify-between gap-4 px-4 py-2", className)}>
      <dt className="text-[12.5px] whitespace-nowrap text-[var(--text-muted)]">{label}</dt>
      <dd className="min-w-0 truncate text-right text-[13px] font-medium">{children}</dd>
    </div>
  );
}
