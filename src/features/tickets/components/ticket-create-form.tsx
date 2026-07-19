"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createTicket } from "@/features/tickets/actions";

type Division = { id: string; name: string };
type Customer = { id: string; displayName: string };
type Tech = { id: string; name: string };

export function TicketCreateForm({
  divisions,
  customers,
  techs,
}: {
  divisions: Division[];
  customers: Customer[];
  techs: Tech[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        const ticket = await createTicket({
          divisionId: String(fd.get("divisionId") || ""),
          title: String(fd.get("title") || ""),
          description: String(fd.get("description") || ""),
          customerId: String(fd.get("customerId") || ""),
          priority: String(fd.get("priority") || "NORMAL"),
          scheduledFor: String(fd.get("scheduledFor") || ""),
          assignedToId: String(fd.get("assignedToId") || ""),
        });
        router.push(`/tickets/${ticket.id}`);
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to create ticket",
        );
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="max-w-xl space-y-4 rounded-lg border border-slate-200 bg-white p-6"
    >
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="divisionId">Division</Label>
        <select
          id="divisionId"
          name="divisionId"
          required
          className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          {divisions.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="customerId">Customer</Label>
        <select
          id="customerId"
          name="customerId"
          className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="">— None —</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.displayName}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="priority">Priority</Label>
          <select
            id="priority"
            name="priority"
            defaultValue="NORMAL"
            className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
          >
            {["LOW", "NORMAL", "HIGH", "URGENT"].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="scheduledFor">Scheduled</Label>
          <Input id="scheduledFor" name="scheduledFor" type="datetime-local" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="assignedToId">Assignee</Label>
        <select
          id="assignedToId"
          name="assignedToId"
          className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="">— Unassigned —</option>
          {techs.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" />
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create ticket"}
      </Button>
    </form>
  );
}
