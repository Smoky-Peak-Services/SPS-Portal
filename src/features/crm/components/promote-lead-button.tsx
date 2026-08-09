"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { promoteLeadToCustomer } from "@/features/crm/actions";
import { FormSelect } from "@/components/patterns/form-select";
import { Button } from "@/components/ui/button";

const TYPE_OPTIONS = [
  { value: "RESIDENTIAL", label: "Residential" },
  { value: "COMMERCIAL", label: "Commercial" },
  { value: "STR", label: "STR" },
];

export function PromoteLeadButton({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [type, setType] = useState("RESIDENTIAL");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-end gap-2">
      <FormSelect
        label="Customer type"
        options={TYPE_OPTIONS}
        value={type}
        onValueChange={setType}
        disabled={pending}
      />
      <Button
        type="button"
        size="sm"
        disabled={pending}
        onClick={() => {
          setError(null);
          start(async () => {
            try {
              const result = await promoteLeadToCustomer({ leadId, type });
              if (!result.ok) {
                setError(result.error);
                return;
              }
              if (result.id) {
                router.push(`/clients/${result.id}`);
              }
              router.refresh();
            } catch (err) {
              setError(
                err instanceof Error ? err.message : "Could not promote lead",
              );
            }
          });
        }}
      >
        {pending ? "Promoting…" : "Promote to client"}
      </Button>
      {error ? (
        <span className="text-sm text-destructive" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
