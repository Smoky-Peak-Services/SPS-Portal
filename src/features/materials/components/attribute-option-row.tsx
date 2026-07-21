"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateOption } from "@/features/materials/actions";
import {
  deleteMaterialAttributeOption,
  forceDeleteMaterialAttributeOption,
} from "@/features/materials/delete-actions";

type Option = {
  id: string;
  value: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
  _count?: { itemValues: number; defaultFor: number };
};

export function AttributeOptionRow({
  option,
  canForceDelete,
}: {
  option: Option;
  canForceDelete: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forceOpen, setForceOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const usage =
    (option._count?.itemValues ?? 0) + (option._count?.defaultFor ?? 0);

  function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      try {
        await updateOption({
          id: option.id,
          value: String(fd.get("value") || ""),
          label: String(fd.get("label") || ""),
          sortOrder: Number(fd.get("sortOrder") || 0),
          isActive: fd.get("isActive") === "on",
        });
        setEditing(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Update failed");
      }
    });
  }

  function runSafeDelete() {
    setError(null);
    start(async () => {
      try {
        await deleteMaterialAttributeOption({ id: option.id });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Delete failed");
      }
    });
  }

  function runForceDelete() {
    setError(null);
    start(async () => {
      try {
        await forceDeleteMaterialAttributeOption({
          id: option.id,
          confirmName,
        });
        setForceOpen(false);
        setConfirmName("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Force delete failed");
      }
    });
  }

  if (editing) {
    return (
      <li className="space-y-2 border-b py-3 last:border-0">
        <form onSubmit={save} className="grid gap-2 sm:grid-cols-2">
          <Input
            name="value"
            defaultValue={option.value}
            required
            placeholder="value key"
            disabled={pending}
          />
          <Input
            name="label"
            defaultValue={option.label}
            required
            placeholder="label"
            disabled={pending}
          />
          <Input
            name="sortOrder"
            type="number"
            defaultValue={option.sortOrder}
            disabled={pending}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={option.isActive}
            />
            Active
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" size="sm" disabled={pending}>
              Save
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
        {error ? <p className="text-xs text-red-700">{error}</p> : null}
      </li>
    );
  }

  return (
    <li className="space-y-1 border-b py-2 last:border-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm">
          {option.label}{" "}
          <span className="text-slate-400">({option.value})</span>
          <span className="ml-2 text-xs text-slate-400">
            #{option.sortOrder} · {option.isActive ? "active" : "inactive"}
          </span>
        </span>
        <div className="flex flex-wrap gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => setEditing(true)}
          >
            Edit
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending || (usage > 0 && !forceOpen)}
            onClick={runSafeDelete}
            title={
              usage > 0
                ? `Used ${usage} time(s) — safe delete blocked`
                : "Safe delete"
            }
          >
            Delete
          </Button>
          {canForceDelete && usage > 0 ? (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={pending}
              onClick={() => {
                setForceOpen((v) => !v);
                setError(null);
              }}
            >
              Force…
            </Button>
          ) : null}
        </div>
      </div>
      {forceOpen ? (
        <div className="rounded border border-red-200 bg-red-50 p-2 text-xs">
          <p className="text-red-900">
            Type <span className="font-semibold">{option.label}</span> to
            permanently delete this option and clear item values / defaults.
          </p>
          <input
            className="mt-1 w-full rounded border border-red-300 px-2 py-1"
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder={option.label}
            disabled={pending}
          />
          <Button
            type="button"
            size="sm"
            variant="destructive"
            className="mt-1"
            disabled={pending || confirmName.trim().length === 0}
            onClick={runForceDelete}
          >
            Confirm force delete
          </Button>
        </div>
      ) : null}
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </li>
  );
}
