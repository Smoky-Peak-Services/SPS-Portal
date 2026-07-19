"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { updateJobStatus } from "@/features/jobs/actions";
import { updateTicketStatus } from "@/features/tickets/actions";

const JOB_STATUSES = [
  "NEW",
  "SCHEDULED",
  "IN_PROGRESS",
  "COMPLETED",
  "ON_HOLD",
  "CANCELLED",
] as const;
const TICKET_STATUSES = [
  "UNASSIGNED",
  "ASSIGNED",
  "EN_ROUTE",
  "ONSITE",
  "COMPLETED",
  "ON_HOLD",
  "CANCELLED",
] as const;

export function StatusButtons({
  kind,
  id,
  current,
}: {
  kind: "job" | "ticket";
  id: string;
  current: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const statuses = kind === "job" ? JOB_STATUSES : TICKET_STATUSES;

  return (
    <div className="flex flex-wrap gap-2">
      {statuses.map((status) => (
        <Button
          key={status}
          type="button"
          size="sm"
          variant={status === current ? "default" : "outline"}
          disabled={pending || status === current}
          onClick={() => {
            startTransition(async () => {
              if (kind === "job") {
                await updateJobStatus({ jobId: id, status });
              } else {
                await updateTicketStatus({ ticketId: id, status });
              }
              router.refresh();
            });
          }}
        >
          {status}
        </Button>
      ))}
    </div>
  );
}
