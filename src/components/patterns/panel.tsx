import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Props = {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
};

/** Elevated surface card used across dashboards and settings. */
export function Panel({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
}: Props) {
  return (
    <Card className={cn("border-border/80 bg-card/80 shadow-none", className)}>
      {title || description || actions ? (
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-0">
          <div className="space-y-1">
            {title ? <CardTitle className="text-base">{title}</CardTitle> : null}
            {description ? (
              <CardDescription>{description}</CardDescription>
            ) : null}
          </div>
          {actions}
        </CardHeader>
      ) : null}
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  );
}
