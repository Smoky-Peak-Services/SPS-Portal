"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { updateLeadStatus } from "@/features/crm/actions";
import { FormSelect } from "@/components/patterns/form-select";

const STATUS_OPTIONS = [
  { value: "INQUIRY", label: "Inquiry" },
  { value: "SITE_VISIT", label: "Site visit" },
  { value: "ESTIMATE_SENT", label: "Estimate sent" },
  { value: "APPROVED", label: "Approved" },
  { value: "WON", label: "Won" },
  { value: "LOST", label: "Lost" },
  { value: "DISQUALIFIED", label: "Disqualified" },
];

export function LeadStatusSelect({
  leadId,
  status,
  disabled,
}: {
  leadId: string;
  status: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <FormSelect
      label="Status"
      options={STATUS_OPTIONS}
      value={status}
      disabled={disabled || pending}
      onValueChange={(next) => {
        if (next === status) return;
        start(async () => {
          await updateLeadStatus({ id: leadId, status: next });
          router.refresh();
        });
      }}
    />
  );
}
