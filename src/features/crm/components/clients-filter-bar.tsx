"use client";

import { FormSelect } from "@/components/patterns/form-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const TYPE_OPTIONS = [
  { value: "RESIDENTIAL", label: "Residential" },
  { value: "COMMERCIAL", label: "Commercial" },
  { value: "STR", label: "STR" },
];

export function ClientsFilterBar({
  divisions,
  q,
  divisionId,
  type,
}: {
  divisions: { id: string; name: string }[];
  q?: string;
  divisionId?: string;
  type?: string;
}) {
  return (
    <form className="flex flex-wrap items-end gap-3" method="get">
      <div className="min-w-[14rem] flex-1 space-y-2">
        <label htmlFor="clients-q" className="text-sm font-medium">
          Search
        </label>
        <Input
          id="clients-q"
          name="q"
          placeholder="Search name, email, phone"
          defaultValue={q ?? ""}
        />
      </div>
      <FormSelect
        id="clients-division"
        name="divisionId"
        label="Division"
        options={divisions.map((d) => ({ value: d.id, label: d.name }))}
        defaultValue={divisionId ?? ""}
        allowEmpty
        emptyLabel="All divisions"
        className="min-w-[12rem]"
      />
      <FormSelect
        id="clients-type"
        name="type"
        label="Type"
        options={TYPE_OPTIONS}
        defaultValue={type ?? ""}
        allowEmpty
        emptyLabel="All types"
        className="min-w-[10rem]"
      />
      <Button type="submit" variant="secondary">
        Filter
      </Button>
    </form>
  );
}
