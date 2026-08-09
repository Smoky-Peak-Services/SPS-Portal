"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createLead } from "@/features/crm/actions";
import { company } from "@/config/company";
import { FormSelect } from "@/components/patterns/form-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type DivisionOpt = { id: string; name: string; slug: string };

const SOURCE_OPTIONS = [
  { value: "PHONE", label: "Phone" },
  { value: "WEBSITE", label: "Website" },
  { value: "REFERRAL", label: "Referral" },
  { value: "WALK_IN", label: "Walk-in" },
  { value: "OTHER", label: "Other" },
];

export function CreateLeadForm({
  divisions,
  defaults,
}: {
  divisions: DivisionOpt[];
  defaults?: { phone?: string; message?: string };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const defaultDivisionId =
    divisions.find((d) => d.slug === company.crm.defaultLeadDivisionSlug)?.id ??
    divisions[0]?.id ??
    "";

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const fd = new FormData(e.currentTarget);
        start(async () => {
          try {
            const result = await createLead({
              source: fd.get("source"),
              divisionId: fd.get("divisionId"),
              name: fd.get("name"),
              email: fd.get("email"),
              phone: fd.get("phone"),
              company: fd.get("company"),
              message: fd.get("message"),
              budget: fd.get("budget"),
              timeline: fd.get("timeline"),
            });
            if (!result.ok) {
              setError(result.error);
              return;
            }
            router.push(result.id ? `/leads/${result.id}` : "/leads");
            router.refresh();
          } catch (err) {
            setError(
              err instanceof Error ? err.message : "Could not create lead",
            );
          }
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required />
        </div>
        <FormSelect
          name="divisionId"
          label="Owning division"
          options={divisions.map((d) => ({ value: d.id, label: d.name }))}
          defaultValue={defaultDivisionId}
          required
        />
        <FormSelect
          name="source"
          label="Source"
          options={SOURCE_OPTIONS}
          defaultValue="PHONE"
          required
        />
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            name="phone"
            defaultValue={defaults?.phone ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="company">Company</Label>
          <Input id="company" name="company" />
        </div>
        <FormSelect
          name="budget"
          label="Budget"
          allowEmpty
          emptyLabel="—"
          options={company.crm.budgetRanges.map((b) => ({
            value: b,
            label: b,
          }))}
        />
        <FormSelect
          name="timeline"
          label="Timeline"
          allowEmpty
          emptyLabel="—"
          options={company.crm.timelines.map((t) => ({
            value: t,
            label: t,
          }))}
        />
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="message">Message</Label>
          <Textarea
            id="message"
            name="message"
            rows={4}
            defaultValue={defaults?.message ?? ""}
          />
        </div>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={pending || !defaultDivisionId}>
        {pending ? "Creating…" : "Create lead"}
      </Button>
    </form>
  );
}
