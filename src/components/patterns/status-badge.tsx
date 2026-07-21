import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const TONES = {
  draft: "border-sky-500/30 bg-sky-500/15 text-sky-300",
  open: "border-primary/30 bg-primary/15 text-primary",
  success: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300",
  warning: "border-amber-500/30 bg-amber-500/15 text-amber-300",
  danger: "border-red-500/30 bg-red-500/15 text-red-300",
  muted: "border-border bg-muted text-muted-foreground",
} as const;

type Props = {
  children: React.ReactNode;
  tone?: keyof typeof TONES;
  className?: string;
};

export function StatusBadge({ children, tone = "muted", className }: Props) {
  return (
    <Badge
      variant="outline"
      className={cn("rounded-md font-medium", TONES[tone], className)}
    >
      {children}
    </Badge>
  );
}
