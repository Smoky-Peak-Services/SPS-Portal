"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createContact,
  deleteContact,
  updateContact,
} from "@/features/crm/actions";
import { FormSelect } from "@/components/patterns/form-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTableShell } from "@/components/patterns/data-table-shell";

const CONTACT_ROLE_OPTIONS = [
  { value: "CLIENT", label: "Client" },
  { value: "PROPERTY_MANAGER", label: "Property manager" },
  { value: "ESTIMATOR", label: "Estimator" },
  { value: "TENANT", label: "Tenant" },
];

type Contact = {
  id: string;
  firstName: string;
  lastName: string | null;
  directEmail: string | null;
  directPhone: string | null;
  roleTag: string | null;
  isPrimary: boolean;
  isBilling: boolean;
};

export function ContactsPanel({
  customerId,
  contacts,
  canWrite,
}: {
  customerId: string;
  contacts: Contact[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <DataTableShell>
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Flags</th>
              {canWrite ? (
                <th className="px-4 py-3 text-right">Actions</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {contacts.map((c) => (
              <tr key={c.id} className="border-b border-border/60">
                <td className="px-4 py-3">
                  {c.firstName}
                  {c.lastName ? ` ${c.lastName}` : ""}
                </td>
                <td className="px-4 py-3">{c.directEmail || "—"}</td>
                <td className="px-4 py-3">{c.directPhone || "—"}</td>
                <td className="px-4 py-3">{c.roleTag || "—"}</td>
                <td className="px-4 py-3 text-xs">
                  {[c.isPrimary ? "Primary" : null, c.isBilling ? "Billing" : null]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </td>
                {canWrite ? (
                  <td className="px-4 py-3 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => {
                        start(async () => {
                          await updateContact({
                            id: c.id,
                            isPrimary: true,
                          });
                          router.refresh();
                        });
                      }}
                    >
                      Make primary
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => {
                        start(async () => {
                          await deleteContact({ id: c.id });
                          router.refresh();
                        });
                      }}
                    >
                      Delete
                    </Button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableShell>

      {canWrite ? (
        <form
          className="grid gap-3 rounded-md border border-border p-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            const fd = new FormData(e.currentTarget);
            start(async () => {
              const result = await createContact({
                customerId,
                firstName: fd.get("firstName"),
                lastName: fd.get("lastName"),
                directEmail: fd.get("directEmail"),
                directPhone: fd.get("directPhone"),
                roleTag: fd.get("roleTag") || undefined,
                isPrimary: fd.get("isPrimary") === "on",
                isBilling: fd.get("isBilling") === "on",
              });
              if (!result.ok) {
                setError(result.error);
                return;
              }
              e.currentTarget.reset();
              router.refresh();
            });
          }}
        >
          <Input name="firstName" placeholder="First name" required />
          <Input name="lastName" placeholder="Last name" />
          <Input name="directEmail" type="email" placeholder="Email" />
          <Input name="directPhone" placeholder="Phone" />
          <FormSelect
            name="roleTag"
            label="Role"
            options={CONTACT_ROLE_OPTIONS}
            defaultValue="CLIENT"
          />
          <div className="flex items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="isPrimary" /> Primary
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="isBilling" /> Billing
            </label>
          </div>
          {error ? (
            <p className="text-sm text-destructive sm:col-span-2">{error}</p>
          ) : null}
          <Button type="submit" disabled={pending} className="sm:col-span-2">
            Add contact
          </Button>
        </form>
      ) : null}
    </div>
  );
}
