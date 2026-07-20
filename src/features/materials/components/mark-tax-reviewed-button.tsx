"use client";

import { useRouter } from "next/navigation";
import { useTransition, useState } from "react";
import { markCategoryTaxReviewed } from "@/features/materials/actions";
import { Button } from "@/components/ui/button";

export function MarkTaxReviewedButton({
  id,
  taxReviewed,
}: {
  id: string;
  taxReviewed: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (taxReviewed) {
    return <span className="text-xs text-slate-400">Reviewed</span>;
  }

  return (
    <div className="text-right">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => {
          setError(null);
          start(async () => {
            try {
              await markCategoryTaxReviewed({ id, taxReviewed: true });
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Failed");
            }
          });
        }}
      >
        Mark reviewed
      </Button>
      {error ? <p className="mt-1 text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
