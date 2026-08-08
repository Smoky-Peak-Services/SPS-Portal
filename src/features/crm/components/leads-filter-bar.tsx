"use client";

import { useRouter, usePathname } from "next/navigation";
import { useTransition } from "react";
import { FormSelect } from "@/components/patterns/form-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type DivisionOpt = { id: string; name: string; slug: string };

export function LeadsFilterBar({
  divisions,
  q,
  divisionId,
}: {
  divisions: DivisionOpt[];
  q?: string;
  divisionId?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const params = new URLSearchParams();
        const nextQ = String(fd.get("q") ?? "").trim();
        const nextDiv = String(fd.get("divisionId") ?? "").trim();
        if (nextQ) params.set("q", nextQ);
        if (nextDiv) params.set("divisionId", nextDiv);
        const qs = params.toString();
        start(() => {
          router.push(qs ? `${pathname}?${qs}` : pathname);
        });
      }}
    >
      <div className="min-w-[12rem] flex-1">
        <Input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search name, email, phone"
        />
      </div>
      <FormSelect
        name="divisionId"
        label="Division"
        allowEmpty
        emptyLabel="All divisions"
        options={divisions.map((d) => ({ value: d.id, label: d.name }))}
        defaultValue={divisionId ?? ""}
      />
      <Button type="submit" variant="outline" disabled={pending}>
        Filter
      </Button>
    </form>
  );
}
