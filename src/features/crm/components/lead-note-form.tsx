"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createLeadActivity } from "@/features/crm/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function LeadNoteForm({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState("");

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const result = await createLeadActivity({ leadId, body });
          if (!result.ok) {
            setError(result.error);
            return;
          }
          setBody("");
          router.refresh();
        });
      }}
    >
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder="Add a note…"
        required
        disabled={pending}
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" size="sm" disabled={pending || !body.trim()}>
        {pending ? "Saving…" : "Add note"}
      </Button>
    </form>
  );
}
