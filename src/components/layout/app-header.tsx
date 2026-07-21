import { cn } from "@/lib/utils";

type Props = {
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
  className?: string;
};

export function AppHeader({ title, subtitle, children, className }: Props) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur md:px-6",
        className,
      )}
    >
      <div className="min-w-0">
        {title ? (
          <h2 className="truncate text-sm font-semibold text-foreground">
            {title}
          </h2>
        ) : null}
        {subtitle ? (
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {children ? (
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      ) : null}
    </header>
  );
}
