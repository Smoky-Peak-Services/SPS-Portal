import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  label: string;
  value: string;
  hint?: string;
  delta?: string;
  deltaTone?: "positive" | "negative" | "neutral";
  className?: string;
  /** Optional sparkline / chart slot */
  footer?: React.ReactNode;
};

export function MetricCard({
  label,
  value,
  hint,
  delta,
  deltaTone = "neutral",
  className,
  footer,
}: Props) {
  return (
    <Card
      className={cn(
        "border-border/80 bg-card/80 shadow-none transition-colors hover:border-primary/30",
        className,
      )}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-end justify-between gap-2">
          <p className="text-2xl font-semibold tracking-tight text-foreground">
            {value}
          </p>
          {delta ? (
            <span
              className={cn(
                "text-xs font-medium",
                deltaTone === "positive" && "text-emerald-400",
                deltaTone === "negative" && "text-orange-400",
                deltaTone === "neutral" && "text-muted-foreground",
              )}
            >
              {delta}
            </span>
          ) : null}
        </div>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        {footer}
      </CardContent>
    </Card>
  );
}
