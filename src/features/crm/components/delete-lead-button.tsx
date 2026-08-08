"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteLead } from "@/features/crm/actions";
import { Button } from "@/components/ui/button";

export function DeleteLeadButton({
  leadId,
  leadName,
}: {
  leadId: string;
  leadName: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant="destructive"
        size="sm"
        disabled={pending}
        onClick={() => {
          if (
            !window.confirm(
              `Delete lead "${leadName}"? This cannot be undone. If already promoted, the client account is kept.`,
            )
          ) {
            return;
          }
          setError(null);
          start(async () => {
            const result = await deleteLead({ id: leadId });
            if (!result.ok) {
              setError(result.error);
              return;
            }
            router.push("/leads");
            router.refresh();
          });
        }}
      >
        {pending ? "Deleting…" : "Delete lead"}
      </Button>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
