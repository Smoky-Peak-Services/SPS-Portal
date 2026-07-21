import { cn } from "@/lib/utils";
import { Panel } from "@/components/patterns/panel";

type Props = {
  title?: string;
  description?: string;
  toolbar?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

/** Table container with optional toolbar — wrap a shadcn Table inside. */
export function DataTableShell({
  title,
  description,
  toolbar,
  children,
  className,
}: Props) {
  return (
    <Panel
      title={title}
      description={description}
      actions={toolbar}
      className={className}
      contentClassName="px-0 pb-0"
    >
      <div className={cn("overflow-x-auto")}>{children}</div>
    </Panel>
  );
}
