"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { assignJob } from "@/features/jobs/actions";
import { assignTicket } from "@/features/tickets/actions";

type Tech = { id: string; name: string };

export function AssignForm({
  kind,
  id,
  techs,
  currentUserId,
}: {
  kind: "job" | "ticket";
  id: string;
  techs: Tech[];
  currentUserId?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const userId = String(fd.get("userId") || "");
    const scheduledFor = String(fd.get("scheduledFor") || "");
    startTransition(async () => {
      if (kind === "job") {
        await assignJob({ jobId: id, userId, scheduledFor });
      } else {
        await assignTicket({ ticketId: id, userId, scheduledFor });
      }
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-wrap items-end gap-3 rounded-md border border-slate-200 bg-slate-50 p-3"
    >
      <div className="space-y-1">
        <Label htmlFor={`user-${id}`}>Tech</Label>
        <select
          id={`user-${id}`}
          name="userId"
          required
          defaultValue={currentUserId ?? ""}
          className="flex h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
        >
          <option value="" disabled>
            Select…
          </option>
          {techs.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`when-${id}`}>When</Label>
        <Input
          id={`when-${id}`}
          name="scheduledFor"
          type="datetime-local"
          className="h-9"
        />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Assign"}
      </Button>
    </form>
  );
}
