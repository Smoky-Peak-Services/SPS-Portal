import Image from "next/image";
import Link from "next/link";
import { company } from "@/config/company";
import { cn } from "@/lib/utils";

type Props = {
  href?: string;
  /** mark = triangle only; lockup = horizontal logo; wordmark = mark + text */
  variant?: "mark" | "lockup" | "wordmark";
  className?: string;
  markClassName?: string;
  priority?: boolean;
};

export function AppLogo({
  href = "/",
  variant = "wordmark",
  className,
  markClassName,
  priority,
}: Props) {
  const mark = (
    <Image
      src={company.brand.mark}
      alt=""
      width={40}
      height={40}
      priority={priority}
      className={cn("h-9 w-9 object-contain", markClassName)}
    />
  );

  const lockup = (
    <Image
      src={company.brand.logoDark}
      alt={company.name}
      width={180}
      height={48}
      priority={priority}
      className={cn("h-10 w-auto object-contain", markClassName)}
    />
  );

  const content =
    variant === "lockup" ? (
      lockup
    ) : variant === "mark" ? (
      mark
    ) : (
      <span className="flex items-center gap-2.5">
        {mark}
        <span className="flex flex-col leading-tight">
          <span className="text-sm font-semibold tracking-wide text-foreground">
            {company.shortName}
          </span>
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Portal
          </span>
        </span>
      </span>
    );

  if (!href) {
    return <div className={cn("inline-flex", className)}>{content}</div>;
  }

  return (
    <Link href={href} className={cn("inline-flex", className)}>
      {content}
    </Link>
  );
}
