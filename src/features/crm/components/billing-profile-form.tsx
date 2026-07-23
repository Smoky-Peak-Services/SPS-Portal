"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateBillingProfile } from "@/features/crm/actions";
import { FormSelect } from "@/components/patterns/form-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ContactOpt = { id: string; firstName: string; lastName: string | null };

type Billing = {
  profileType: "INDIVIDUAL" | "ENTITY";
  billingName: string | null;
  billingEmail: string | null;
  billingPhone: string | null;
  billingLine1: string | null;
  billingLine2: string | null;
  billingCity: string | null;
  billingRegion: string | null;
  billingPostal: string | null;
  pointOfContactId: string | null;
  taxExemptionNumber: string | null;
  taxExemptEntityType: string | null;
  taxExemptCertOnFile: boolean;
  smaStatus: string | null;
} | null;

const PROFILE_TYPE_OPTIONS = [
  { value: "INDIVIDUAL", label: "Individual" },
  { value: "ENTITY", label: "Entity" },
];

const TAX_EXEMPT_OPTIONS = [
  { value: "GOVERNMENT", label: "Government" },
  { value: "CHURCH", label: "Church" },
  { value: "SCHOOL", label: "School" },
  { value: "OTHER", label: "Other" },
];

const SMA_STATUS_OPTIONS = [
  { value: "ACTIVE_PAYG", label: "Active (pay as you go)" },
  { value: "ACTIVE_TERM", label: "Active (term)" },
  { value: "INACTIVE", label: "Inactive" },
];

export function BillingProfileForm({
  rootOrgId,
  billing,
  contacts,
  canWrite,
  missing,
}: {
  rootOrgId: string;
  billing: Billing;
  contacts: ContactOpt[];
  canWrite: boolean;
  missing: string[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {missing.length > 0 ? (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          Billing incomplete: missing {missing.join(", ")}. Quoting will require
          a complete profile later.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">Billing profile complete.</p>
      )}

      {canWrite ? (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            const fd = new FormData(e.currentTarget);
            start(async () => {
              const result = await updateBillingProfile({
                rootOrgId,
                profileType: fd.get("profileType"),
                billingName: fd.get("billingName"),
                billingEmail: fd.get("billingEmail"),
                billingPhone: fd.get("billingPhone"),
                billingLine1: fd.get("billingLine1"),
                billingLine2: fd.get("billingLine2"),
                billingCity: fd.get("billingCity"),
                billingRegion: fd.get("billingRegion"),
                billingPostal: fd.get("billingPostal"),
                pointOfContactId: fd.get("pointOfContactId") || "",
                taxExemptionNumber: fd.get("taxExemptionNumber"),
                taxExemptEntityType: fd.get("taxExemptEntityType") || null,
                taxExemptCertOnFile: fd.get("taxExemptCertOnFile") === "on",
                smaStatus: fd.get("smaStatus") || null,
              });
              if (!result.ok) {
                setError(result.error);
                return;
              }
              router.refresh();
            });
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormSelect
              id="profileType"
              name="profileType"
              label="Profile type"
              options={PROFILE_TYPE_OPTIONS}
              defaultValue={billing?.profileType ?? "INDIVIDUAL"}
              required
            />
            <div className="space-y-2">
              <Label htmlFor="billingName">Billing name</Label>
              <Input
                id="billingName"
                name="billingName"
                defaultValue={billing?.billingName ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="billingEmail">Billing email</Label>
              <Input
                id="billingEmail"
                name="billingEmail"
                type="email"
                defaultValue={billing?.billingEmail ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="billingPhone">Billing phone</Label>
              <Input
                id="billingPhone"
                name="billingPhone"
                defaultValue={billing?.billingPhone ?? ""}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              name="billingLine1"
              placeholder="Billing line 1"
              defaultValue={billing?.billingLine1 ?? ""}
            />
            <Input
              name="billingLine2"
              placeholder="Billing line 2"
              defaultValue={billing?.billingLine2 ?? ""}
            />
            <Input
              name="billingCity"
              placeholder="City"
              defaultValue={billing?.billingCity ?? ""}
            />
            <Input
              name="billingRegion"
              placeholder="State"
              defaultValue={billing?.billingRegion ?? ""}
            />
            <Input
              name="billingPostal"
              placeholder="Postal"
              defaultValue={billing?.billingPostal ?? ""}
            />
            <FormSelect
              name="pointOfContactId"
              label="Point of contact"
              options={contacts.map((c) => ({
                value: c.id,
                label: `${c.firstName}${c.lastName ? ` ${c.lastName}` : ""}`,
              }))}
              defaultValue={billing?.pointOfContactId ?? ""}
              allowEmpty
              emptyLabel="No point of contact"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              name="taxExemptionNumber"
              placeholder="Tax exemption #"
              defaultValue={billing?.taxExemptionNumber ?? ""}
            />
            <FormSelect
              name="taxExemptEntityType"
              label="Tax-exempt entity type"
              options={TAX_EXEMPT_OPTIONS}
              defaultValue={billing?.taxExemptEntityType ?? ""}
              allowEmpty
              emptyLabel="None"
            />
            <FormSelect
              name="smaStatus"
              label="SMA status"
              options={SMA_STATUS_OPTIONS}
              defaultValue={billing?.smaStatus ?? ""}
              allowEmpty
              emptyLabel="None"
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="taxExemptCertOnFile"
                defaultChecked={billing?.taxExemptCertOnFile ?? false}
              />
              Tax-exempt cert on file
            </label>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save billing"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
