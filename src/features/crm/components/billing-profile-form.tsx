"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateBillingProfile } from "@/features/crm/actions";
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
            <div className="space-y-2">
              <Label htmlFor="profileType">Profile type</Label>
              <select
                id="profileType"
                name="profileType"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                defaultValue={billing?.profileType ?? "INDIVIDUAL"}
              >
                <option value="INDIVIDUAL">Individual</option>
                <option value="ENTITY">Entity</option>
              </select>
            </div>
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
            <select
              name="pointOfContactId"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              defaultValue={billing?.pointOfContactId ?? ""}
            >
              <option value="">Point of contact</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName}
                  {c.lastName ? ` ${c.lastName}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              name="taxExemptionNumber"
              placeholder="Tax exemption #"
              defaultValue={billing?.taxExemptionNumber ?? ""}
            />
            <select
              name="taxExemptEntityType"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              defaultValue={billing?.taxExemptEntityType ?? ""}
            >
              <option value="">Tax-exempt entity type</option>
              <option value="GOVERNMENT">Government</option>
              <option value="CHURCH">Church</option>
              <option value="SCHOOL">School</option>
              <option value="OTHER">Other</option>
            </select>
            <select
              name="smaStatus"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              defaultValue={billing?.smaStatus ?? ""}
            >
              <option value="">SMA status</option>
              <option value="ACTIVE_PAYG">Active (pay as you go)</option>
              <option value="ACTIVE_TERM">Active (term)</option>
              <option value="INACTIVE">Inactive</option>
            </select>
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
